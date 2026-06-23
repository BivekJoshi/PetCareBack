import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

// Lightweight user shape embedded in messages / conversation summaries.
export const userMini = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

// Trimmed projection of the message a reply points at (for the quoted preview).
const replyPreviewSelect = {
  id: true,
  content: true,
  attachmentName: true,
  attachmentType: true,
  deletedAt: true,
  senderId: true,
  sender: { select: { id: true, firstName: true, lastName: true } },
};

export const messageSelect = {
  id: true,
  type: true,
  content: true,
  attachmentUrl: true,
  attachmentName: true,
  attachmentType: true,
  attachmentSize: true,
  senderId: true,
  recipientId: true,
  groupId: true,
  readAt: true,
  editedAt: true,
  deletedAt: true,
  isForwarded: true,
  replyToId: true,
  replyTo: { select: replyPreviewSelect },
  createdAt: true,
  sender: { select: userMini },
};

// Exclude messages the user "deleted for me".
export const notHiddenBy = (userId) => ({ hides: { none: { userId } } });

// Map of targetId → nickname for the given owner (their custom names).
const nicknameMapFor = async (ownerId) => {
  const rows = await prisma.nickname.findMany({
    where: { ownerId },
    select: { targetId: true, label: true },
  });
  return new Map(rows.map((r) => [r.targetId, r.label]));
};

// Pull only the attachment columns from a validated attachment payload.
const attachmentData = (attachment) =>
  attachment
    ? {
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentType: attachment.type,
        attachmentSize: attachment.size,
      }
    : {};

export const chatService = {
  /** People the current user can start a chat with (everyone else, active). */
  async listContacts(userId, search) {
    const where = {
      id: { not: userId },
      isActive: true,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, nicknames] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userMini,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 100,
      }),
      nicknameMapFor(userId),
    ]);

    return users.map((u) => ({ ...u, nickname: nicknames.get(u.id) || null }));
  },

  /** Set (or update) the current user's private nickname for someone. */
  async setNickname(ownerId, targetId, label) {
    if (ownerId === targetId) throw ApiError.badRequest('You cannot nickname yourself');
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw ApiError.notFound('User not found');

    return prisma.nickname.upsert({
      where: { ownerId_targetId: { ownerId, targetId } },
      create: { ownerId, targetId, label },
      update: { label },
      select: { targetId: true, label: true },
    });
  },

  /** Clear a nickname (revert to the person's real name). */
  async removeNickname(ownerId, targetId) {
    await prisma.nickname.deleteMany({ where: { ownerId, targetId } });
  },

  /**
   * One row per person the user has exchanged direct messages with, carrying
   * the latest message and the count of unread messages from that person.
   */
  async listConversations(userId) {
    // Unread direct messages grouped by who sent them.
    const unreadGroups = await prisma.message.groupBy({
      by: ['senderId'],
      where: { type: 'DIRECT', recipientId: userId, readAt: null },
      _count: { _all: true },
    });
    const unreadBy = new Map(unreadGroups.map((g) => [g.senderId, g._count._all]));

    // Recent direct messages involving the user; reduce to latest-per-partner.
    const recent = await prisma.message.findMany({
      where: {
        type: 'DIRECT',
        OR: [{ senderId: userId }, { recipientId: userId }],
        ...notHiddenBy(userId),
      },
      select: messageSelect,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const latestByPartner = new Map();
    for (const msg of recent) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!partnerId || latestByPartner.has(partnerId)) continue;
      latestByPartner.set(partnerId, msg);
    }

    const partnerIds = [...latestByPartner.keys()];
    if (partnerIds.length === 0) return [];

    const [partners, nicknames] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: partnerIds } }, select: userMini }),
      nicknameMapFor(userId),
    ]);
    const partnerById = new Map(partners.map((p) => [p.id, p]));

    return partnerIds
      .map((id) => {
        const user = partnerById.get(id);
        return {
          user: user ? { ...user, nickname: nicknames.get(id) || null } : null,
          lastMessage: latestByPartner.get(id),
          unread: unreadBy.get(id) || 0,
        };
      })
      .filter((c) => c.user) // guard against deleted accounts
      .sort(
        (a, b) =>
          new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt),
      );
  },

  /** Messages exchanged one-to-one between `userId` and `otherId` (oldest→newest). */
  async getDirectThread(userId, otherId, { page, limit }) {
    if (userId === otherId) {
      throw ApiError.badRequest('You cannot open a conversation with yourself');
    }

    const where = {
      type: 'DIRECT',
      OR: [
        { senderId: userId, recipientId: otherId },
        { senderId: otherId, recipientId: userId },
      ],
      ...notHiddenBy(userId),
    };

    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        select: messageSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return {
      items: rows.reverse(), // return chronological for easy rendering
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /** The single broadcast channel everyone shares (oldest→newest). */
  async getBroadcast(userId, { page, limit }) {
    const where = { type: 'BROADCAST', ...notHiddenBy(userId) };
    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        select: messageSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return {
      items: rows.reverse(),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // Validate that a replied-to message exists and belongs to this thread.
  async resolveReply(replyToId, { senderId, recipientId, type }) {
    if (!replyToId) return null;
    const target = await prisma.message.findUnique({
      where: { id: replyToId },
      select: { id: true, type: true, senderId: true, recipientId: true },
    });
    if (!target || target.type !== type) return null;
    if (type === 'DIRECT') {
      const pair = new Set([senderId, recipientId]);
      if (!pair.has(target.senderId) || !pair.has(target.recipientId)) return null;
    }
    return target.id;
  },

  /** Persist a one-to-one message. Returns it with the sender populated. */
  async createDirect(senderId, recipientId, content, attachment = null, replyToId = null) {
    if (senderId === recipientId) {
      throw ApiError.badRequest('You cannot message yourself');
    }
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, isActive: true },
    });
    if (!recipient || !recipient.isActive) {
      throw ApiError.notFound('Recipient not found');
    }

    const validReplyId = await this.resolveReply(replyToId, {
      senderId,
      recipientId,
      type: 'DIRECT',
    });

    return prisma.message.create({
      data: {
        type: 'DIRECT',
        content: content || '',
        senderId,
        recipientId,
        replyToId: validReplyId,
        ...attachmentData(attachment),
      },
      select: messageSelect,
    });
  },

  /** Persist a broadcast (announcement) message. */
  async createBroadcast(senderId, content, attachment = null, replyToId = null) {
    const validReplyId = await this.resolveReply(replyToId, {
      senderId,
      type: 'BROADCAST',
    });

    return prisma.message.create({
      data: {
        type: 'BROADCAST',
        content: content || '',
        senderId,
        recipientId: null,
        replyToId: validReplyId,
        ...attachmentData(attachment),
      },
      select: messageSelect,
    });
  },

  /** Edit a message's text. Only the author may edit; tombstones can't be edited. */
  async editMessage(userId, messageId, content) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, deletedAt: true },
    });
    if (!msg) throw ApiError.notFound('Message not found');
    if (msg.senderId !== userId) throw ApiError.forbidden('You can only edit your own messages');
    if (msg.deletedAt) throw ApiError.badRequest('Cannot edit a deleted message');

    return prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      select: messageSelect,
    });
  },

  /**
   * "Delete for everyone" — only the author can. Replaces the message with a
   * tombstone (clears text + attachment) so both sides see "message deleted".
   */
  async deleteForEveryone(userId, messageId) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true },
    });
    if (!msg) throw ApiError.notFound('Message not found');
    if (msg.senderId !== userId) {
      throw ApiError.forbidden('You can only delete your own messages for everyone');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '',
        attachmentUrl: null,
        attachmentName: null,
        attachmentType: null,
        attachmentSize: null,
      },
      select: messageSelect,
    });
  },

  /** "Delete for me" — hides the message from this user only. */
  async deleteForMe(userId, messageId) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true },
    });
    if (!msg) throw ApiError.notFound('Message not found');

    await prisma.messageHide.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: {},
    });
  },

  /** Forward an existing message's content/attachment to another user. */
  async forwardMessage(userId, sourceId, recipientId) {
    const source = await prisma.message.findUnique({
      where: { id: sourceId },
      select: {
        content: true,
        deletedAt: true,
        attachmentUrl: true,
        attachmentName: true,
        attachmentType: true,
        attachmentSize: true,
      },
    });
    if (!source) throw ApiError.notFound('Original message not found');
    if (source.deletedAt) throw ApiError.badRequest('Cannot forward a deleted message');

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, isActive: true },
    });
    if (!recipient || !recipient.isActive) throw ApiError.notFound('Recipient not found');

    return prisma.message.create({
      data: {
        type: 'DIRECT',
        content: source.content || '',
        senderId: userId,
        recipientId,
        isForwarded: true,
        attachmentUrl: source.attachmentUrl,
        attachmentName: source.attachmentName,
        attachmentType: source.attachmentType,
        attachmentSize: source.attachmentSize,
      },
      select: messageSelect,
    });
  },

  /** Mark every message `otherId → userId` as read. Returns how many changed. */
  async markThreadRead(userId, otherId) {
    const { count } = await prisma.message.updateMany({
      where: {
        type: 'DIRECT',
        senderId: otherId,
        recipientId: userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return count;
  },

  /** Total unread direct messages for the badge in the shell. */
  async unreadCount(userId) {
    return prisma.message.count({
      where: { type: 'DIRECT', recipientId: userId, readAt: null },
    });
  },

  /** Upsert a push token for this user/device. */
  async registerDevice(userId, token, platform) {
    return prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform, userId },
      update: { userId, platform },
      select: { id: true, token: true, platform: true },
    });
  },

  async removeDevice(userId, token) {
    await prisma.deviceToken.deleteMany({ where: { token, userId } });
  },
};
