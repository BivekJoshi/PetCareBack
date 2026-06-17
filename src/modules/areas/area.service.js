import { prisma } from '../../config/prisma.js';

export const areaService = {
  async list({ level, parentId, search }) {
    const where = {
      ...(level ? { level } : {}),
      ...(parentId ? { parentId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const items = await prisma.administrativeArea.findMany({
      where,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: { parent: { select: { id: true, name: true, level: true } } },
    });
    return { items };
  },

  async create(input) {
    return prisma.administrativeArea.create({ data: input });
  },
};
