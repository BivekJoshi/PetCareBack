import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const isPrivileged = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN';

const include = {
  pet: { select: { id: true, name: true, species: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  vet: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
  service: { select: { id: true, name: true, priceCents: true } },
};

// Restricts the queryable set to what the actor is allowed to see.
const scopeFor = async (actor) => {
  if (isPrivileged(actor.role)) return {};
  if (actor.role === 'VET') {
    const vet = await prisma.vet.findUnique({ where: { userId: actor.id } });
    return { vetId: vet?.id ?? '__none__' };
  }
  return { ownerId: actor.id };
};

export const appointmentService = {
  async list(query, actor) {
    const { page, limit, status, petId, vetId } = query;
    const where = {
      ...(await scopeFor(actor)),
      ...(status ? { status } : {}),
      ...(petId ? { petId } : {}),
      ...(vetId ? { vetId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.appointment.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id, actor) {
    const appt = await prisma.appointment.findUnique({ where: { id }, include });
    if (!appt) throw ApiError.notFound('Appointment not found');

    const allowed =
      isPrivileged(actor.role) ||
      appt.ownerId === actor.id ||
      (actor.role === 'VET' && appt.vet?.id && appt.vetId);
    if (!allowed) throw ApiError.forbidden('You do not have access to this appointment');

    return appt;
  },

  async create(input, actor) {
    // The pet must exist and belong to the actor (unless admin).
    const pet = await prisma.pet.findUnique({ where: { id: input.petId } });
    if (!pet) throw ApiError.badRequest('Pet does not exist');
    if (!isPrivileged(actor.role) && pet.ownerId !== actor.id) {
      throw ApiError.forbidden('You can only book appointments for your own pets');
    }

    if (input.vetId) {
      const vet = await prisma.vet.findUnique({ where: { id: input.vetId } });
      if (!vet) throw ApiError.badRequest('Vet does not exist');
    }
    if (input.serviceId) {
      const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
      if (!service) throw ApiError.badRequest('Service does not exist');
    }

    return prisma.appointment.create({
      data: {
        petId: input.petId,
        ownerId: pet.ownerId,
        vetId: input.vetId,
        serviceId: input.serviceId,
        scheduledAt: input.scheduledAt,
        reason: input.reason,
        notes: input.notes,
      },
      include,
    });
  },

  async update(id, data, actor) {
    await this.getById(id, actor); // access check
    return prisma.appointment.update({ where: { id }, data, include });
  },

  async updateStatus(id, status, actor) {
    const appt = await this.getById(id, actor);

    // Owners may only cancel; staff can move through any status.
    if (!isPrivileged(actor.role) && actor.role !== 'VET' && status !== 'CANCELLED') {
      throw ApiError.forbidden('You may only cancel your appointments');
    }

    return prisma.appointment.update({
      where: { id: appt.id },
      data: { status },
      include,
    });
  },

  async remove(id, actor) {
    await this.getById(id, actor);
    await prisma.appointment.delete({ where: { id } });
  },
};
