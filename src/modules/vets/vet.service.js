import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/password.js';

const vetInclude = {
  user: {
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true },
  },
};

export const vetService = {
  async list({ page, limit, isAvailable, search }) {
    const where = {
      ...(typeof isAvailable === 'boolean' ? { isAvailable } : {}),
      ...(search
        ? {
            OR: [
              { specialization: { contains: search, mode: 'insensitive' } },
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vet.findMany({
        where,
        include: vetInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vet.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id) {
    const vet = await prisma.vet.findUnique({ where: { id }, include: vetInclude });
    if (!vet) throw ApiError.notFound('Vet not found');
    return vet;
  },

  // Creates the backing User (role VET) and the Vet profile in one transaction.
  async create(input) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          password: passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          role: 'VET',
        },
      });

      return tx.vet.create({
        data: {
          userId: user.id,
          specialization: input.specialization,
          licenseNumber: input.licenseNumber,
          bio: input.bio,
          yearsExp: input.yearsExp ?? 0,
        },
        include: vetInclude,
      });
    });
  },

  async update(id, data) {
    await this.getById(id);
    return prisma.vet.update({ where: { id }, data, include: vetInclude });
  },

  async remove(id) {
    const vet = await this.getById(id);
    // Removing the user cascades to the vet profile.
    await prisma.user.delete({ where: { id: vet.userId } });
  },
};
