import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const publicSelect = {
  id: true,
  key: true,
  name: true,
  emoji: true,
  tint: true,
  sortOrder: true,
  isActive: true,
};

// Default species seeded into a fresh system. Only dogs and cats by default —
// admins add the rest from the UI.
const DEFAULT_SPECIES = [
  { key: 'DOG', name: 'Dog', emoji: '🐶', tint: '#F57C00', sortOrder: 1 },
  { key: 'CAT', name: 'Cat', emoji: '🐱', tint: '#8E5DD9', sortOrder: 2 },
];

// Annotate each species row with how many pets currently use it.
const withCounts = async (rows) => {
  const groups = await prisma.pet.groupBy({ by: ['species'], _count: { _all: true } });
  const byKey = Object.fromEntries(groups.map((g) => [g.species, g._count._all]));
  return rows.map((r) => ({ ...r, petCount: byKey[r.key] || 0 }));
};

export const speciesService = {
  /** Active species (with live pet counts) — public, powers pickers + landing page. */
  async listPublic() {
    const rows = await prisma.species.findMany({
      where: { isActive: true },
      select: publicSelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return withCounts(rows);
  },

  /** Every species including inactive — admin management view. */
  async listAll() {
    const rows = await prisma.species.findMany({
      select: publicSelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return withCounts(rows);
  },

  async getById(id) {
    const species = await prisma.species.findUnique({ where: { id }, select: publicSelect });
    if (!species) throw ApiError.notFound('Species not found');
    return species;
  },

  async create(data) {
    const existing = await prisma.species.findUnique({ where: { key: data.key } });
    if (existing) throw ApiError.conflict(`A species with key "${data.key}" already exists`);
    return prisma.species.create({ data, select: publicSelect });
  },

  async update(id, data) {
    await this.getById(id);
    return prisma.species.update({ where: { id }, data, select: publicSelect });
  },

  async remove(id) {
    const species = await this.getById(id);
    const inUse = await prisma.pet.count({ where: { species: species.key } });
    if (inUse > 0) {
      throw ApiError.conflict(
        `Cannot delete "${species.name}" — ${inUse} pet(s) still use it. Deactivate it instead.`,
      );
    }
    await prisma.species.delete({ where: { id } });
  },

  /**
   * Guard used by the pet module: a pet may only be created/updated with a
   * species that exists and is active.
   */
  async assertValid(key) {
    const species = await prisma.species.findUnique({ where: { key } });
    if (!species || !species.isActive) {
      throw ApiError.badRequest(`Unknown or inactive species: ${key}`);
    }
  },

  /** Idempotently seed the default species (DOG, CAT). */
  async seedDefaults() {
    for (const d of DEFAULT_SPECIES) {
      await prisma.species.upsert({ where: { key: d.key }, create: d, update: {} });
    }
  },
};
