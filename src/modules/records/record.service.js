import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const isPrivileged = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
const isVetOrPrivileged = (role) => role === 'VET' || isPrivileged(role);

const resolveVetId = async (actor) => {
  if (actor.role !== 'VET') return null;
  const vet = await prisma.vet.findUnique({ where: { userId: actor.id }, select: { id: true } });
  return vet?.id ?? null;
};

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

export const recordService = {
  async list({ page, limit, petId, type }, actor) {
    if (petId) await assertPetAccess(petId, actor);

    const where = {
      ...(petId ? { petId } : {}),
      ...(type ? { type } : {}),
      ...(isVetOrPrivileged(actor.role) ? {} : { pet: { ownerId: actor.id } }),
    };

    const [items, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { pet: petSelect, vet: vetSelect },
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  // A vet logs this after verifying the pet by its code.
  async create(input, actor) {
    if (!isVetOrPrivileged(actor.role)) {
      throw ApiError.forbidden('Only veterinarians can add medical records');
    }
    await assertPetAccess(input.petId, actor);

    const vetId = input.vetId ?? (await resolveVetId(actor));
    return prisma.medicalRecord.create({
      data: { ...input, vetId },
      include: { pet: petSelect, vet: vetSelect },
    });
  },

  async remove(id, actor) {
    if (!isPrivileged(actor.role)) throw ApiError.forbidden('Not allowed');
    await prisma.medicalRecord.delete({ where: { id } });
  },
};
