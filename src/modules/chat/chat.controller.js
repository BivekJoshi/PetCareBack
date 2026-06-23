import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { chatService } from './chat.service.js';
import { dispatchDirectMessage, dispatchBroadcast } from '../../socket/index.js';

export const chatController = {
  contacts: asyncHandler(async (req, res) => {
    const data = await chatService.listContacts(req.user.id, req.query.search);
    sendSuccess(res, { message: 'Contacts fetched', data });
  }),

  conversations: asyncHandler(async (req, res) => {
    const data = await chatService.listConversations(req.user.id);
    sendSuccess(res, { message: 'Conversations fetched', data });
  }),

  thread: asyncHandler(async (req, res) => {
    const { items, meta } = await chatService.getDirectThread(
      req.user.id,
      req.params.userId,
      req.query,
    );
    sendSuccess(res, { message: 'Messages fetched', data: { items, meta } });
  }),

  broadcast: asyncHandler(async (req, res) => {
    const { items, meta } = await chatService.getBroadcast(req.query);
    sendSuccess(res, { message: 'Broadcast fetched', data: { items, meta } });
  }),

  // Sending also works over plain REST (no socket needed); we still push the
  // message through the realtime layer so connected clients update instantly.
  sendDirect: asyncHandler(async (req, res) => {
    const message = await chatService.createDirect(
      req.user.id,
      req.body.recipientId,
      req.body.content,
      req.body.attachment,
    );
    dispatchDirectMessage(message);
    sendSuccess(res, { statusCode: 201, message: 'Message sent', data: message });
  }),

  sendBroadcast: asyncHandler(async (req, res) => {
    const message = await chatService.createBroadcast(
      req.user.id,
      req.body.content,
      req.body.attachment,
    );
    dispatchBroadcast(message);
    sendSuccess(res, { statusCode: 201, message: 'Broadcast sent', data: message });
  }),

  // Receives a single multipart "file" and returns its public metadata; the
  // client then sends a message referencing this attachment.
  upload: asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    sendSuccess(res, {
      statusCode: 201,
      message: 'File uploaded',
      data: {
        url,
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
      },
    });
  }),

  markRead: asyncHandler(async (req, res) => {
    const count = await chatService.markThreadRead(req.user.id, req.params.userId);
    sendSuccess(res, { message: 'Marked as read', data: { count } });
  }),

  unread: asyncHandler(async (req, res) => {
    const count = await chatService.unreadCount(req.user.id);
    sendSuccess(res, { message: 'Unread count', data: { count } });
  }),

  registerDevice: asyncHandler(async (req, res) => {
    const data = await chatService.registerDevice(
      req.user.id,
      req.body.token,
      req.body.platform,
    );
    sendSuccess(res, { statusCode: 201, message: 'Device registered', data });
  }),

  removeDevice: asyncHandler(async (req, res) => {
    await chatService.removeDevice(req.user.id, req.body.token);
    sendSuccess(res, { message: 'Device removed' });
  }),
};
