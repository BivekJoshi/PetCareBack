import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { generatePetCode } from '../../utils/petCode.js';
import { speciesService } from '../species/species.service.js';

const isPrivileged = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN';
const isVetOrPrivileged = (role) => role === 'VET' || isPrivileged(role);

const ownerSelect = { select: { id: true, firstName: true, lastName: true, email: true, phone: true } };
const areaSelect = { select: { id: true, name: true, level: true } };

export const petService = {
  async list({ page, limit, species, search }, actor) {
    const where = {
      // Owners only see their own pets; admins see all.
      ...(isPrivileged(actor.role) ? {} : { ownerId: actor.id }),
      ...(species ? { species } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.pet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { owner: ownerSelect, area: areaSelect },
      }),
      prisma.pet.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id, actor) {
    const pet = await prisma.pet.findUnique({
      where: { id },
      include: { owner: ownerSelect, area: areaSelect },
    });
    if (!pet) throw ApiError.notFound('Pet not found');
    if (!isPrivileged(actor.role) && pet.ownerId !== actor.id) {
      throw ApiError.forbidden('You do not have access to this pet');
    }
    return pet;
  },

  /**
   * Vet-facing lookup by public registration code. Returns the pet together
   * with its owner, vaccination history and medical records — this is what a
   * vet pulls up before treating or prescribing. Vets and admins only.
   */
  async lookupByCode(code, actor) {
    if (!isVetOrPrivileged(actor.role)) {
      throw ApiError.forbidden('Only veterinarians can look up pets by code');
    }
    const pet = await prisma.pet.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        owner: ownerSelect,
        area: areaSelect,
        vaccinations: { orderBy: { createdAt: 'desc' } },
        records: {
          orderBy: { createdAt: 'desc' },
          include: { vet: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
        },
      },
    });
    if (!pet) throw ApiError.notFound('No pet found for that code');
    return pet;
  },

  async create(input, actor) {
    // A pet's species must be a valid, active catalogue entry.
    if (input.species) await speciesService.assertValid(input.species);

    // Owners can only create pets for themselves.
    const ownerId = isPrivileged(actor.role) && input.ownerId ? input.ownerId : actor.id;

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw ApiError.badRequest('Owner does not exist');

    const { ownerId: _ignored, ...data } = input;
    const code = await generatePetCode();

    // Inherit the owner's area/location when the pet's own aren't supplied.
    return prisma.pet.create({
      data: {
        ...data,
        code,
        ownerId,
        areaId: data.areaId ?? owner.areaId ?? null,
        latitude: data.latitude ?? owner.latitude ?? null,
        longitude: data.longitude ?? owner.longitude ?? null,
      },
      include: { owner: ownerSelect, area: areaSelect },
    });
  },

  async update(id, data, actor) {
    await this.getById(id, actor); // enforces ownership
    if (data.species) await speciesService.assertValid(data.species);
    return prisma.pet.update({
      where: { id },
      data,
      include: { owner: ownerSelect, area: areaSelect },
    });
  },

  async remove(id, actor) {
    await this.getById(id, actor);
    await prisma.pet.delete({ where: { id } });
  },
};
