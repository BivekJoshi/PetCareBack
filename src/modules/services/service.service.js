import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export const serviceService = {
  async list({ page, limit, isActive, search }) {
    const where = {
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.service.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  },

  async create(data) {
    return prisma.service.create({ data });
  },

  async update(id, data) {
    await this.getById(id);
    return prisma.service.update({ where: { id }, data });
  },

  async remove(id) {
    await this.getById(id);
    await prisma.service.delete({ where: { id } });
  },
};
