import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const isSuperAdmin = (role) => role === 'SUPER_ADMIN';

// The Vet profile of the signed-in vet (services are owned by it).
const requireVetProfile = async (actor) => {
  const vet = await prisma.vet.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!vet) throw ApiError.forbidden('Only an approved vet can manage services');
  return vet;
};

const include = {
  vet: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
};

export const serviceService = {
  async list({ page, limit, isActive, search, vetId, mine }, actor) {
    // `mine` resolves to the signed-in vet's own services.
    let scopedVetId = vetId;
    if (mine) {
      const vet = await prisma.vet.findUnique({ where: { userId: actor.id }, select: { id: true } });
      scopedVetId = vet?.id ?? '__none__';
    }

    const where = {
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(scopedVetId ? { vetId: scopedVetId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.service.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id) {
    const service = await prisma.service.findUnique({ where: { id }, include });
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  },

  // A vet adds a service to their own list.
  async create(data, actor) {
    const vet = await requireVetProfile(actor);
    const duplicate = await prisma.service.findFirst({
      where: { vetId: vet.id, name: data.name },
      select: { id: true },
    });
    if (duplicate) throw ApiError.conflict('You already offer a service with that name');
    return prisma.service.create({ data: { ...data, vetId: vet.id }, include });
  },

  async update(id, data, actor) {
    const service = await this.getById(id);
    await this.assertOwnership(service, actor);
    return prisma.service.update({ where: { id }, data, include });
  },

  async remove(id, actor) {
    const service = await this.getById(id);
    await this.assertOwnership(service, actor);
    await prisma.service.delete({ where: { id } });
  },

  // A vet may only touch their own services; a super admin may touch any.
  async assertOwnership(service, actor) {
    if (isSuperAdmin(actor.role)) return;
    const vet = await requireVetProfile(actor);
    if (service.vetId !== vet.id) {
      throw ApiError.forbidden('You can only manage your own services');
    }
  },
};
