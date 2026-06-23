import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { chatService } from '../modules/chat/chat.service.js';
import { sendPushToUser, sendPushBroadcast } from '../services/push.service.js';

let io = null;

// userId → Set(socketId). A user is "online" while this set is non-empty.
const online = new Map();

// userId → { callId, partnerId }. Tracks who is in a live 1:1 call so we can
// reject incoming calls to a busy user and tear calls down on disconnect.
const calls = new Map();

const userRoom = (userId) => `user:${userId}`;
const BROADCAST_ROOM = 'broadcast';

const fullName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim();
const clip = (text) => (text.length > 80 ? `${text.slice(0, 77)}…` : text);
// Notification body: the text, or a label for attachment-only messages.
const preview = (message) => {
  const text = String(message?.content || '').trim();
  if (text) return clip(text);
  if (message?.attachmentName) return `📎 ${message.attachmentName}`;
  return clip('');
};

export const getIO = () => io;
export const isUserOnline = (userId) => online.has(userId);
export const getOnlineUserIds = () => [...online.keys()];

/** Emit an event to all of a user's connected sockets/tabs. */
export const emitToUser = (userId, event, payload) => {
  if (io) io.to(userRoom(userId)).emit(event, payload);
};

const addPresence = (userId, socketId) => {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socketId);
  return online.get(userId).size === 1; // became online just now
};

const removePresence = (userId, socketId) => {
  const set = online.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    online.delete(userId);
    return true; // went offline
  }
  return false;
};

// ── Dispatch helpers — shared by socket handlers and the REST controller ──

/** Deliver a freshly-created direct message in real time + notify/push. */
export const dispatchDirectMessage = (message) => {
  emitToUser(message.recipientId, 'message:new', message);
  emitToUser(message.senderId, 'message:new', message); // sync sender's tabs

  const title = fullName(message.sender) || 'New message';
  emitToUser(message.recipientId, 'notification:new', {
    kind: 'direct',
    title,
    body: preview(message),
    fromUserId: message.senderId,
    messageId: message.id,
    createdAt: message.createdAt,
  });

  // Push only when the recipient has no live socket — live ones get the
  // in-app/system notification above instead.
  if (!isUserOnline(message.recipientId)) {
    sendPushToUser(message.recipientId, {
      title,
      body: preview(message),
      data: { kind: 'direct', fromUserId: message.senderId, messageId: message.id },
    });
  }
};

/** Deliver a broadcast to everyone + notify/push (excluding the author). */
export const dispatchBroadcast = (message) => {
  if (!io) return;
  io.to(BROADCAST_ROOM).emit('broadcast:new', message);

  const title = `📣 ${fullName(message.sender) || 'Announcement'}`;
  io.to(BROADCAST_ROOM).emit('notification:new', {
    kind: 'broadcast',
    title,
    body: preview(message),
    fromUserId: message.senderId,
    messageId: message.id,
    createdAt: message.createdAt,
  });

  sendPushBroadcast(message.senderId, {
    title,
    body: preview(message),
    data: { kind: 'broadcast', messageId: message.id },
  });
};

// ── Socket auth — verify the JWT supplied in the handshake ──
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (socket.handshake.headers?.authorization || '').replace(/^Bearer /, '');

    if (!token) return next(new Error('Authentication token missing'));

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return next(new Error('User not found or inactive'));

    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

const safeAck = (ack, payload) => {
  if (typeof ack === 'function') ack(payload);
};

const registerHandlers = (socket) => {
  const me = socket.user;

  socket.on('message:send', async ({ recipientId, content, attachment } = {}, ack) => {
    try {
      const text = String(content || '').trim();
      if (!recipientId || (!text && !attachment)) {
        return safeAck(ack, { ok: false, error: 'recipientId and a message or file are required' });
      }
      const message = await chatService.createDirect(me.id, recipientId, text, attachment);
      dispatchDirectMessage(message);
      safeAck(ack, { ok: true, message });
    } catch (err) {
      safeAck(ack, { ok: false, error: err.message || 'Failed to send message' });
    }
  });

  socket.on('broadcast:send', async ({ content, attachment } = {}, ack) => {
    try {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(me.role)) {
        return safeAck(ack, { ok: false, error: 'Only admins can broadcast' });
      }
      const text = String(content || '').trim();
      if (!text && !attachment) {
        return safeAck(ack, { ok: false, error: 'A message or file is required' });
      }

      const message = await chatService.createBroadcast(me.id, text, attachment);
      dispatchBroadcast(message);
      safeAck(ack, { ok: true, message });
    } catch (err) {
      safeAck(ack, { ok: false, error: err.message || 'Failed to broadcast' });
    }
  });

  socket.on('message:read', async ({ otherId } = {}) => {
    if (!otherId) return;
    try {
      const count = await chatService.markThreadRead(me.id, otherId);
      if (count > 0) {
        // Tell the other party their messages were read (for read receipts)…
        emitToUser(otherId, 'message:read', { by: me.id });
        // …and keep this user's own tabs/badges in sync.
        emitToUser(me.id, 'thread:read', { otherId });
      }
    } catch (err) {
      logger.error('message:read failed', err);
    }
  });

  socket.on('typing', ({ recipientId, isTyping } = {}) => {
    if (!recipientId) return;
    emitToUser(recipientId, 'typing', { from: me.id, isTyping: Boolean(isTyping) });
  });

  // ── 1:1 voice/video calls (WebRTC signaling) ──
  // The server only brokers the handshake; audio/video flows peer-to-peer.

  socket.on('call:initiate', ({ toUserId, callType } = {}, ack) => {
    if (!toUserId) return safeAck(ack, { ok: false, error: 'toUserId is required' });
    if (toUserId === me.id) return safeAck(ack, { ok: false, error: 'Cannot call yourself' });
    if (!isUserOnline(toUserId)) {
      return safeAck(ack, { ok: false, error: 'User is offline' });
    }
    if (calls.has(toUserId) || calls.has(me.id)) {
      return safeAck(ack, { ok: false, error: 'User is on another call' });
    }

    const callId = randomUUID();
    emitToUser(toUserId, 'call:incoming', {
      callId,
      callType: callType === 'audio' ? 'audio' : 'video',
      from: {
        id: me.id,
        firstName: me.firstName,
        lastName: me.lastName,
        role: me.role,
      },
    });
    return safeAck(ack, { ok: true, callId });
  });

  socket.on('call:accept', ({ callId, toUserId } = {}) => {
    if (!toUserId) return;
    calls.set(me.id, { callId, partnerId: toUserId });
    calls.set(toUserId, { callId, partnerId: me.id });
    emitToUser(toUserId, 'call:accepted', { callId, by: me.id });
  });

  socket.on('call:reject', ({ callId, toUserId } = {}) => {
    if (toUserId) emitToUser(toUserId, 'call:rejected', { callId, by: me.id });
  });

  socket.on('call:cancel', ({ callId, toUserId } = {}) => {
    if (toUserId) emitToUser(toUserId, 'call:cancelled', { callId, by: me.id });
  });

  socket.on('call:end', ({ callId, toUserId } = {}) => {
    calls.delete(me.id);
    if (toUserId) {
      calls.delete(toUserId);
      emitToUser(toUserId, 'call:ended', { callId, by: me.id });
    }
  });

  // SDP offer/answer + ICE candidate relays — passed straight through.
  socket.on('call:offer', ({ callId, toUserId, sdp } = {}) => {
    if (toUserId) emitToUser(toUserId, 'call:offer', { callId, sdp, from: me.id });
  });
  socket.on('call:answer', ({ callId, toUserId, sdp } = {}) => {
    if (toUserId) emitToUser(toUserId, 'call:answer', { callId, sdp, from: me.id });
  });
  socket.on('call:ice-candidate', ({ callId, toUserId, candidate } = {}) => {
    if (toUserId) {
      emitToUser(toUserId, 'call:ice-candidate', { callId, candidate, from: me.id });
    }
  });
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const me = socket.user;
    socket.join(userRoom(me.id));
    socket.join(BROADCAST_ROOM);

    const cameOnline = addPresence(me.id, socket.id);
    if (cameOnline) socket.broadcast.emit('presence:update', { userId: me.id, online: true });

    // Send the current online roster to the newly-connected client.
    socket.emit('presence:list', { online: getOnlineUserIds() });

    logger.info(`Socket connected: ${fullName(me)} (${me.id})`);

    registerHandlers(socket);

    socket.on('disconnect', () => {
      const wentOffline = removePresence(me.id, socket.id);
      if (wentOffline) {
        io.emit('presence:update', { userId: me.id, online: false });

        // If they were on a call, hang it up for the other party.
        const active = calls.get(me.id);
        if (active) {
          calls.delete(me.id);
          calls.delete(active.partnerId);
          emitToUser(active.partnerId, 'call:ended', {
            callId: active.callId,
            by: me.id,
          });
        }

        logger.info(`Socket disconnected: ${fullName(me)} (${me.id})`);
      }
    });
  });

  logger.info('Socket.IO initialised');
  return io;
};
