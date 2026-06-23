import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EMAIL_TEMPLATE_DEFAULTS } from '../src/modules/emailTemplates/emailTemplate.defaults.js';

const prisma = new PrismaClient();

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const hash = (pw) => bcrypt.hash(pw, SALT_ROUNDS);

async function main() {
  console.log('Seeding database…');

  // ── Administrative areas (province → district → municipality → ward) ──
  const province = await prisma.administrativeArea.upsert({
    where: { code: 'P3' },
    update: {},
    create: { name: 'Bagmati', level: 'PROVINCE', code: 'P3' },
  });
  const district = await prisma.administrativeArea.upsert({
    where: { code: 'P3-KTM' },
    update: {},
    create: { name: 'Kathmandu', level: 'DISTRICT', code: 'P3-KTM', parentId: province.id },
  });
  const municipality = await prisma.administrativeArea.upsert({
    where: { code: 'P3-KTM-KMC' },
    update: {},
    create: {
      name: 'Kathmandu Metropolitan City',
      level: 'MUNICIPALITY',
      code: 'P3-KTM-KMC',
      parentId: district.id,
      latitude: 27.7172,
      longitude: 85.324,
    },
  });
  const ward = await prisma.administrativeArea.upsert({
    where: { code: 'P3-KTM-KMC-10' },
    update: {},
    create: {
      name: 'Ward 10',
      level: 'WARD',
      code: 'P3-KTM-KMC-10',
      parentId: municipality.id,
      latitude: 27.7,
      longitude: 85.32,
    },
  });

  // ── Super admin (government officer) ─────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      password: await hash('P@ssw0rd'),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      areaId: municipality.id,
    },
  });

  // ── Pet owner ────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: 'owner@gmail.com' },
    update: {},
    create: {
      email: 'owner@gmail.com',
      password: await hash('P@ssw0rd'),
      firstName: 'Pat',
      lastName: 'Owner',
      role: 'PET_OWNER',
      areaId: ward.id,
      latitude: 27.701,
      longitude: 85.321,
    },
  });

  // ── Vet (user + clinic + profile) ────────────
  const vetUser = await prisma.user.upsert({
    where: { email: 'vet@gmail.com' },
    update: {},
    create: {
      email: 'vet@gmail.com',
      password: await hash('P@ssw0rd'),
      firstName: 'Vera',
      lastName: 'Vet',
      role: 'VET',
      areaId: ward.id,
    },
  });

  const clinic = await prisma.clinic.upsert({
    where: { id: 'seed-clinic-0001' },
    update: {},
    create: {
      id: 'seed-clinic-0001',
      name: 'Bagmati Animal Care',
      phone: '+977-1-5550000',
      email: 'clinic@petcare.test',
      address: 'New Road, Ward 10',
      areaId: ward.id,
      latitude: 27.702,
      longitude: 85.319,
    },
  });

  const vet = await prisma.vet.upsert({
    where: { userId: vetUser.id },
    update: {},
    create: {
      userId: vetUser.id,
      clinicId: clinic.id,
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

  // ── A sample registered pet ──────────────────
  let pet = await prisma.pet.findFirst({ where: { ownerId: owner.id, name: 'Rex' } });
  if (!pet) {
    pet = await prisma.pet.create({
      data: {
        code: 'NP-PET-REX01',
        name: 'Rex',
        species: 'DOG',
        breed: 'Labrador',
        gender: 'MALE',
        ownerId: owner.id,
        areaId: ward.id,
        latitude: 27.701,
        longitude: 85.321,
        isRegistered: true,
      },
    });

    // A sample vaccination with a future due date (feeds reminders).
    await prisma.vaccination.create({
      data: {
        petId: pet.id,
        vetId: vet.id,
        vaccineName: 'Rabies',
        doseNumber: 1,
        status: 'ADMINISTERED',
        administeredAt: new Date('2026-06-01T00:00:00Z'),
        nextDueAt: new Date('2027-06-01T00:00:00Z'),
        isSubsidized: true,
      },
    });

    // A care-tip reminder for the owner.
    await prisma.reminder.create({
      data: {
        userId: owner.id,
        petId: pet.id,
        type: 'CARE_TIP',
        title: 'Summer hydration',
        message: 'Keep Rex hydrated and avoid midday walks during the heat.',
        dueAt: new Date('2026-06-20T00:00:00Z'),
      },
    });
  }

  // ── Editable email templates (admin Control Panel) ──
  for (const def of Object.values(EMAIL_TEMPLATE_DEFAULTS)) {
    await prisma.emailTemplate.upsert({
      where: { key: def.key },
      update: {}, // don't clobber admin edits on re-seed
      create: { key: def.key, name: def.name, subject: def.subject, html: def.html },
    });
  }

  console.log('Seed complete.');
  console.log('  Super admin : admin@gmail.com / P@ssw0rd');
  console.log('  Pet owner   : owner@gmail.com / P@ssw0rd');
  console.log('  Vet         : vet@gmail.com   / P@ssw0rd');
  console.log('  Sample pet code : NP-PET-REX01');
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
