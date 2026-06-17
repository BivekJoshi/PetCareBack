import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const isPrivileged = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
const isStaff = (role) => role === 'VET' || isPrivileged(role);

const petSelect = { select: { id: true, name: true, code: true } };

export const reminderService = {
  // Everyone sees their own reminders; admins may view any user's via userId.
  async list({ page, limit, status, type, userId }, actor) {
    const targetUserId = isPrivileged(actor.role) && userId ? userId : actor.id;

    const where = {
      userId: targetUserId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [items, total, unread] = await Promise.all([
      prisma.reminder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueAt: 'asc' },
        include: { pet: petSelect },
      }),
      prisma.reminder.count({ where }),
      prisma.reminder.count({ where: { userId: targetUserId, status: { in: ['PENDING', 'SENT'] } } }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit), unread } };
  },

  // Staff schedule reminders for owners; an owner may create one for themselves.
  async create(input, actor) {
    const userId = isStaff(actor.role) && input.userId ? input.userId : actor.id;
    const { userId: _ignored, ...rest } = input;
    return prisma.reminder.create({ data: { ...rest, userId }, include: { pet: petSelect } });
  },

  async markRead(id, actor) {
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) throw ApiError.notFound('Reminder not found');
    if (reminder.userId !== actor.id && !isPrivileged(actor.role)) {
      throw ApiError.forbidden('Not your reminder');
    }
    return prisma.reminder.update({ where: { id }, data: { status: 'READ' }, include: { pet: petSelect } });
  },

  async remove(id, actor) {
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) throw ApiError.notFound('Reminder not found');
    if (reminder.userId !== actor.id && !isPrivileged(actor.role)) {
      throw ApiError.forbidden('Not your reminder');
    }
    await prisma.reminder.delete({ where: { id } });
  },
};
