import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

// Lightweight user shape embedded in messages / conversation summaries.
const userMini = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

const messageSelect = {
  id: true,
  type: true,
  content: true,
  attachmentUrl: true,
  attachmentName: true,
  attachmentType: true,
  attachmentSize: true,
  senderId: true,
  recipientId: true,
  readAt: true,
  createdAt: true,
  sender: { select: userMini },
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

    return prisma.user.findMany({
      where,
      select: userMini,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 100,
    });
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

    const partners = await prisma.user.findMany({
      where: { id: { in: partnerIds } },
      select: userMini,
    });
    const partnerById = new Map(partners.map((p) => [p.id, p]));

    return partnerIds
      .map((id) => ({
        user: partnerById.get(id),
        lastMessage: latestByPartner.get(id),
        unread: unreadBy.get(id) || 0,
      }))
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
  async getBroadcast({ page, limit }) {
    const where = { type: 'BROADCAST' };
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

  /** Persist a one-to-one message. Returns it with the sender populated. */
  async createDirect(senderId, recipientId, content, attachment = null) {
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

    return prisma.message.create({
      data: {
        type: 'DIRECT',
        content: content || '',
        senderId,
        recipientId,
        ...attachmentData(attachment),
      },
      select: messageSelect,
    });
  },

  /** Persist a broadcast (announcement) message. */
  async createBroadcast(senderId, content, attachment = null) {
    return prisma.message.create({
      data: {
        type: 'BROADCAST',
        content: content || '',
        senderId,
        recipientId: null,
        ...attachmentData(attachment),
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
