import { prisma } from '../../config/prisma.js';

const userMini = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

export const callService = {
  /** Log a freshly-dialed call (status RINGING). Best-effort. */
  async start(callId, callerId, calleeId, type) {
    return prisma.call.create({
      data: {
        id: callId,
        callerId,
        calleeId,
        type: type === 'audio' ? 'AUDIO' : 'VIDEO',
        status: 'RINGING',
      },
    });
  },

  /** Mark a call as connected. */
  async accept(callId) {
    await prisma.call.updateMany({
      where: { id: callId, status: 'RINGING' },
      data: { status: 'ONGOING', startedAt: new Date() },
    });
  },

  /**
   * Close a connected call: COMPLETED with a computed duration. Returns a
   * summary of the finished call, or null if it was already terminal (so the
   * caller can avoid logging a duplicate call message).
   */
  async complete(callId) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { callerId: true, calleeId: true, type: true, startedAt: true, status: true },
    });
    if (!call || ['COMPLETED', 'MISSED', 'DECLINED', 'CANCELLED'].includes(call.status)) {
      return null;
    }
    const now = new Date();
    const durationSec = call.startedAt
      ? Math.max(0, Math.round((now - call.startedAt) / 1000))
      : 0;
    await prisma.call.update({
      where: { id: callId },
      data: { status: 'COMPLETED', endedAt: now, durationSec },
    });
    return {
      callerId: call.callerId,
      calleeId: call.calleeId,
      type: call.type,
      status: 'COMPLETED',
      durationSec,
    };
  },

  /**
   * Set a non-connected terminal status (DECLINED / MISSED / CANCELLED).
   * Returns a summary of the call, or null if it had already ended.
   */
  async terminal(callId, status) {
    const { count } = await prisma.call.updateMany({
      where: { id: callId, status: { in: ['RINGING', 'ONGOING'] } },
      data: { status, endedAt: new Date() },
    });
    if (count === 0) return null;
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { callerId: true, calleeId: true, type: true },
    });
    if (!call) return null;
    return {
      callerId: call.callerId,
      calleeId: call.calleeId,
      type: call.type,
      status,
      durationSec: 0,
    };
  },

  /** Recent call log for a user, newest first, with the other party attached. */
  async list(userId) {
    const [calls, nicknames] = await Promise.all([
      prisma.call.findMany({
        where: { OR: [{ callerId: userId }, { calleeId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { caller: { select: userMini }, callee: { select: userMini } },
      }),
      prisma.nickname.findMany({
        where: { ownerId: userId },
        select: { targetId: true, label: true },
      }),
    ]);
    const nickById = new Map(nicknames.map((n) => [n.targetId, n.label]));

    return calls.map((c) => {
      const outgoing = c.callerId === userId;
      const other = outgoing ? c.callee : c.caller;
      return {
        id: c.id,
        type: c.type,
        status: c.status,
        durationSec: c.durationSec,
        direction: outgoing ? 'outgoing' : 'incoming',
        createdAt: c.createdAt,
        user: { ...other, nickname: nickById.get(other.id) || null },
      };
    });
  },
};
