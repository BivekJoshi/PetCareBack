import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { userMini, messageSelect, notHiddenBy } from './chat.service.js';

// Ensure the user belongs to the group; returns their membership (with isAdmin).
const requireMembership = async (groupId, userId) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true, isAdmin: true },
  });
  if (!membership) throw ApiError.forbidden('You are not a member of this group');
  return membership;
};

export const groupService = {
  /** Create a group with the creator as admin plus the given members. */
  async create(creatorId, name, memberIds = []) {
    const unique = [...new Set(memberIds.filter((id) => id && id !== creatorId))];

    const found = await prisma.user.findMany({
      where: { id: { in: unique }, isActive: true },
      select: { id: true },
    });
    const validIds = found.map((u) => u.id);

    const group = await prisma.group.create({
      data: {
        name,
        createdById: creatorId,
        members: {
          create: [
            { userId: creatorId, isAdmin: true },
            ...validIds.map((id) => ({ userId: id })),
          ],
        },
      },
      select: { id: true },
    });

    return this.getSummary(group.id, creatorId);
  },

  /** A single group's summary (name, members, last message) for one user. */
  async getSummary(groupId, userId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        createdById: true,
        createdAt: true,
        members: {
          select: { userId: true, isAdmin: true, user: { select: userMini } },
        },
        messages: {
          where: notHiddenBy(userId),
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: messageSelect,
        },
      },
    });
    if (!group) throw ApiError.notFound('Group not found');

    const me = group.members.find((m) => m.userId === userId);
    return {
      id: group.id,
      name: group.name,
      createdById: group.createdById,
      createdAt: group.createdAt,
      memberCount: group.members.length,
      isAdmin: Boolean(me?.isAdmin),
      members: group.members.map((m) => ({ ...m.user, isAdmin: m.isAdmin })),
      lastMessage: group.messages[0] || null,
    };
  },

  /** Every group the user is a member of, most-recently-active first. */
  async list(userId) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const summaries = await Promise.all(
      memberships.map((m) => this.getSummary(m.groupId, userId)),
    );
    return summaries.sort((a, b) => {
      const at = a.lastMessage?.createdAt || a.createdAt;
      const bt = b.lastMessage?.createdAt || b.createdAt;
      return new Date(bt) - new Date(at);
    });
  },

  /** Messages in a group (oldest→newest), membership enforced. */
  async getMessages(userId, groupId, { page, limit }) {
    await requireMembership(groupId, userId);
    const where = { type: 'GROUP', groupId, ...notHiddenBy(userId) };

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

  /** Post a message to a group. Returns { message, memberIds } for dispatch. */
  async createMessage(senderId, groupId, content, attachment = null, replyToId = null) {
    await requireMembership(groupId, senderId);

    let validReplyId = null;
    if (replyToId) {
      const target = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { id: true, groupId: true, type: true },
      });
      if (target && target.type === 'GROUP' && target.groupId === groupId) {
        validReplyId = target.id;
      }
    }

    const message = await prisma.message.create({
      data: {
        type: 'GROUP',
        content: content || '',
        senderId,
        groupId,
        replyToId: validReplyId,
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
        attachmentType: attachment?.type,
        attachmentSize: attachment?.size,
      },
      select: messageSelect,
    });

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    return { message, memberIds: members.map((m) => m.userId) };
  },

  async members(userId, groupId) {
    await requireMembership(groupId, userId);
    const rows = await prisma.groupMember.findMany({
      where: { groupId },
      select: { isAdmin: true, joinedAt: true, user: { select: userMini } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => ({ ...r.user, isAdmin: r.isAdmin, joinedAt: r.joinedAt }));
  },

  async addMembers(userId, groupId, memberIds = []) {
    const membership = await requireMembership(groupId, userId);
    if (!membership.isAdmin) throw ApiError.forbidden('Only group admins can add members');

    const existing = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((m) => m.userId));
    const toAdd = [...new Set(memberIds)].filter((id) => id && !existingIds.has(id));

    if (toAdd.length) {
      const valid = await prisma.user.findMany({
        where: { id: { in: toAdd }, isActive: true },
        select: { id: true },
      });
      await prisma.groupMember.createMany({
        data: valid.map((u) => ({ groupId, userId: u.id })),
        skipDuplicates: true,
      });
    }
    return this.getSummary(groupId, userId);
  },

  async removeMember(userId, groupId, targetId) {
    const membership = await requireMembership(groupId, userId);
    if (!membership.isAdmin) throw ApiError.forbidden('Only group admins can remove members');
    if (targetId === userId) throw ApiError.badRequest('Use "leave group" to remove yourself');
    await prisma.groupMember.deleteMany({ where: { groupId, userId: targetId } });
    return this.getSummary(groupId, userId);
  },

  /** Leave a group; deletes the group entirely if nobody remains. */
  async leave(userId, groupId) {
    await requireMembership(groupId, userId);
    await prisma.groupMember.deleteMany({ where: { groupId, userId } });
    const remaining = await prisma.groupMember.count({ where: { groupId } });
    if (remaining === 0) {
      await prisma.group.delete({ where: { id: groupId } });
    }
  },

  async rename(userId, groupId, name) {
    const membership = await requireMembership(groupId, userId);
    if (!membership.isAdmin) throw ApiError.forbidden('Only group admins can rename the group');
    await prisma.group.update({ where: { id: groupId }, data: { name } });
    return this.getSummary(groupId, userId);
  },

  /** Member ids of a group (for socket fan-out). */
  async memberIds(groupId) {
    const rows = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },
};
