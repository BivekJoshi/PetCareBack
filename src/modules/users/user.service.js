import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/password.js';

const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const userService = {
  async list({ page, limit, role, search }) {
    const where = {
      ...(role ? { role } : {}),
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

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: publicUser,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id) {
    const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async create(input) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    return prisma.user.create({
      data: { ...input, password: await hashPassword(input.password) },
      select: publicUser,
    });
  },

  async update(id, data) {
    await this.getById(id);
    return prisma.user.update({ where: { id }, data, select: publicUser });
  },

  async remove(id) {
    await this.getById(id);
    await prisma.user.delete({ where: { id } });
  },
};
