import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const hash = (pw) => bcrypt.hash(pw, SALT_ROUNDS);

async function main() {
  console.log('Seeding database…');

  // ── Super admin ──────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@petcare.test' },
    update: {},
    create: {
      email: 'admin@petcare.test',
      password: await hash('Admin@123'),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
  });

  // ── Pet owner ────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: 'owner@petcare.test' },
    update: {},
    create: {
      email: 'owner@petcare.test',
      password: await hash('Owner@123'),
      firstName: 'Pat',
      lastName: 'Owner',
      role: 'PET_OWNER',
    },
  });

  // ── Vet (user + profile) ─────────────────────
  const vetUser = await prisma.user.upsert({
    where: { email: 'vet@petcare.test' },
    update: {},
    create: {
      email: 'vet@petcare.test',
      password: await hash('Vet@1234'),
      firstName: 'Vera',
      lastName: 'Vet',
      role: 'VET',
    },
  });

  await prisma.vet.upsert({
    where: { userId: vetUser.id },
    update: {},
    create: {
      userId: vetUser.id,
      specialization: 'General Practice',
      licenseNumber: 'VET-0001',
      yearsExp: 6,
      bio: 'Friendly neighbourhood veterinarian.',
    },
  });

  // ── Services ─────────────────────────────────
  const services = [
    { name: 'General Checkup', description: 'Routine health examination', priceCents: 5000, durationMin: 30 },
    { name: 'Vaccination', description: 'Core vaccine administration', priceCents: 3500, durationMin: 20 },
    { name: 'Grooming', description: 'Bath, trim and nail clipping', priceCents: 4000, durationMin: 60 },
    { name: 'Dental Cleaning', description: 'Professional teeth cleaning', priceCents: 9000, durationMin: 45 },
  ];
  for (const s of services) {
    await prisma.service.upsert({ where: { name: s.name }, update: {}, create: s });
  }

  // ── A sample pet ─────────────────────────────
  const existingPet = await prisma.pet.findFirst({ where: { ownerId: owner.id, name: 'Rex' } });
  if (!existingPet) {
    await prisma.pet.create({
      data: {
        name: 'Rex',
        species: 'DOG',
        breed: 'Labrador',
        gender: 'MALE',
        ownerId: owner.id,
      },
    });
  }

  console.log('Seed complete.');
  console.log('  Super admin : admin@petcare.test / Admin@123');
  console.log('  Pet owner   : owner@petcare.test / Owner@123');
  console.log('  Vet         : vet@petcare.test   / Vet@1234');
  void superAdmin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
