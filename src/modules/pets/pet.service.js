import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const isPrivileged = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN';

export const petService = {
  async list({ page, limit, species, search }, actor) {
    const where = {
      // Owners only see their own pets; admins see all.
      ...(isPrivileged(actor.role) ? {} : { ownerId: actor.id }),
      ...(species ? { species } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.pet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.pet.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id, actor) {
    const pet = await prisma.pet.findUnique({
      where: { id },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!pet) throw ApiError.notFound('Pet not found');
    if (!isPrivileged(actor.role) && pet.ownerId !== actor.id) {
      throw ApiError.forbidden('You do not have access to this pet');
    }
    return pet;
  },

  async create(input, actor) {
    // Owners can only create pets for themselves.
    const ownerId = isPrivileged(actor.role) && input.ownerId ? input.ownerId : actor.id;

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw ApiError.badRequest('Owner does not exist');

    const { ownerId: _ignored, ...data } = input;
    return prisma.pet.create({ data: { ...data, ownerId } });
  },

  async update(id, data, actor) {
    await this.getById(id, actor); // enforces ownership
    return prisma.pet.update({ where: { id }, data });
  },

  async remove(id, actor) {
    await this.getById(id, actor);
    await prisma.pet.delete({ where: { id } });
  },
};
