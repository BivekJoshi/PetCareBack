import { prisma } from '../../config/prisma.js';

export const statsService = {
  /**
   * Government overview: headline numbers a municipality officer cares about —
   * registry size, vaccination coverage, subsidy reach, species mix.
   */
  async overview() {
    const now = new Date();
    const [
      pets,
      registeredPets,
      owners,
      vets,
      clinics,
      areas,
      administered,
      subsidized,
      overdue,
      speciesGroups,
    ] = await Promise.all([
      prisma.pet.count(),
      prisma.pet.count({ where: { isRegistered: true } }),
      prisma.user.count({ where: { role: 'PET_OWNER' } }),
      prisma.vet.count(),
      prisma.clinic.count(),
      prisma.administrativeArea.count(),
      prisma.vaccination.count({ where: { status: 'ADMINISTERED' } }),
      prisma.vaccination.count({ where: { isSubsidized: true } }),
      prisma.vaccination.count({
        where: { OR: [{ status: 'OVERDUE' }, { status: 'SCHEDULED', nextDueAt: { lt: now } }] },
      }),
      prisma.pet.groupBy({ by: ['species'], _count: { _all: true } }),
    ]);

    // Pets with at least one administered vaccine → coverage %.
    const vaccinatedPets = await prisma.pet.count({
      where: { vaccinations: { some: { status: 'ADMINISTERED' } } },
    });

    const species = speciesGroups
      .map((g) => ({ species: g.species, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return {
      totals: { pets, registeredPets, owners, vets, clinics, areas },
      vaccination: {
        administered,
        subsidized,
        overdue,
        vaccinatedPets,
        coverage: pets ? Math.round((vaccinatedPets / pets) * 100) : 0,
      },
      species,
    };
  },

  /**
   * Per-area breakdown for the map / planning table: pet count and vaccination
   * coverage for each administrative area. Optionally scope to one area's
   * children (e.g. wards within a municipality) via parentId.
   */
  async byArea({ level, parentId }) {
    const areas = await prisma.administrativeArea.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(parentId ? { parentId } : {}),
      },
      select: { id: true, name: true, level: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    });

    const ids = areas.map((a) => a.id);
    if (ids.length === 0) return { areas: [] };

    const [petGroups, vaccinatedPets] = await Promise.all([
      prisma.pet.groupBy({ by: ['areaId'], where: { areaId: { in: ids } }, _count: { _all: true } }),
      prisma.pet.findMany({
        where: { areaId: { in: ids }, vaccinations: { some: { status: 'ADMINISTERED' } } },
        select: { areaId: true },
      }),
    ]);

    const petCountByArea = Object.fromEntries(petGroups.map((g) => [g.areaId, g._count._all]));
    const vaccinatedByArea = vaccinatedPets.reduce((acc, p) => {
      acc[p.areaId] = (acc[p.areaId] || 0) + 1;
      return acc;
    }, {});

    const rows = areas.map((a) => {
      const petCount = petCountByArea[a.id] || 0;
      const vaccinatedCount = vaccinatedByArea[a.id] || 0;
      return {
        ...a,
        petCount,
        vaccinatedCount,
        coverage: petCount ? Math.round((vaccinatedCount / petCount) * 100) : 0,
      };
    });

    // Most populous first — where planning effort should focus.
    rows.sort((a, b) => b.petCount - a.petCount);
    return { areas: rows };
  },
};
