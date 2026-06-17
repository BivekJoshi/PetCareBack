import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const isPrivileged = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
const isVetOrPrivileged = (role) => role === 'VET' || isPrivileged(role);

// Resolve the Vet profile id for a VET user (null for everyone else).
const resolveVetId = async (actor) => {
  if (actor.role !== 'VET') return null;
  const vet = await prisma.vet.findUnique({ where: { userId: actor.id }, select: { id: true } });
  return vet?.id ?? null;
};

// An owner may only touch vaccinations for pets they own.
const assertPetAccess = async (petId, actor) => {
  const pet = await prisma.pet.findUnique({ where: { id: petId }, select: { id: true, ownerId: true } });
  if (!pet) throw ApiError.notFound('Pet not found');
  if (!isVetOrPrivileged(actor.role) && pet.ownerId !== actor.id) {
    throw ApiError.forbidden('You do not have access to this pet');
  }
  return pet;
};

const petSelect = { select: { id: true, name: true, code: true, species: true } };
const vetSelect = { select: { id: true, user: { select: { firstName: true, lastName: true } } } };

export const vaccinationService = {
  async list({ page, limit, petId, status }, actor) {
    if (petId) await assertPetAccess(petId, actor);

    const where = {
      ...(petId ? { petId } : {}),
      ...(status ? { status } : {}),
      // Owners are scoped to their own pets even without a petId filter.
      ...(isVetOrPrivileged(actor.role) ? {} : { pet: { ownerId: actor.id } }),
    };

    const [items, total] = await Promise.all([
      prisma.vaccination.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'desc' }],
        include: { pet: petSelect, vet: vetSelect },
      }),
      prisma.vaccination.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(input, actor) {
    if (!isVetOrPrivileged(actor.role)) {
      throw ApiError.forbidden('Only veterinarians can record vaccinations');
    }
    await assertPetAccess(input.petId, actor);

    const vetId = input.vetId ?? (await resolveVetId(actor));
    return prisma.vaccination.create({
      data: { ...input, vetId },
      include: { pet: petSelect, vet: vetSelect },
    });
  },

  async update(id, data, actor) {
    if (!isVetOrPrivileged(actor.role)) {
      throw ApiError.forbidden('Only veterinarians can update vaccinations');
    }
    const existing = await prisma.vaccination.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Vaccination not found');
    return prisma.vaccination.update({
      where: { id },
      data,
      include: { pet: petSelect, vet: vetSelect },
    });
  },

  async remove(id, actor) {
    if (!isPrivileged(actor.role)) throw ApiError.forbidden('Not allowed');
    await prisma.vaccination.delete({ where: { id } });
  },
};
