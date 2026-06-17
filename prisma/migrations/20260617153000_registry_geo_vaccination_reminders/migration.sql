-- CreateEnum
CREATE TYPE "AreaLevel" AS ENUM ('PROVINCE', 'DISTRICT', 'MUNICIPALITY', 'WARD');

-- CreateEnum
CREATE TYPE "VaccinationStatus" AS ENUM ('SCHEDULED', 'ADMINISTERED', 'OVERDUE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('CHECKUP', 'TREATMENT', 'PRESCRIPTION', 'DIET', 'SURGERY');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('VACCINE', 'CHECKUP', 'DEWORMING', 'CARE_TIP', 'GENERAL');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('PUSH', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PetSpecies" ADD VALUE 'CATTLE';
ALTER TYPE "PetSpecies" ADD VALUE 'GOAT';

-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "isRegistered" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isSterilized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "microchipId" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "vets" ADD COLUMN     "clinicId" TEXT;

-- CreateTable
CREATE TABLE "administrative_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "AreaLevel" NOT NULL,
    "code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "administrative_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "areaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccinations" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vetId" TEXT,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "VaccinationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "administeredAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "batchNo" TEXT,
    "isSubsidized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vetId" TEXT,
    "appointmentId" TEXT,
    "type" "RecordType" NOT NULL DEFAULT 'CHECKUP',
    "diagnosis" TEXT,
    "treatment" TEXT,
    "medicine" TEXT,
    "diet" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "petId" TEXT,
    "type" "ReminderType" NOT NULL DEFAULT 'GENERAL',
    "channel" "ReminderChannel" NOT NULL DEFAULT 'PUSH',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "administrative_areas_code_key" ON "administrative_areas"("code");

-- CreateIndex
CREATE INDEX "administrative_areas_level_idx" ON "administrative_areas"("level");

-- CreateIndex
CREATE INDEX "administrative_areas_parentId_idx" ON "administrative_areas"("parentId");

-- CreateIndex
CREATE INDEX "clinics_areaId_idx" ON "clinics"("areaId");

-- CreateIndex
CREATE INDEX "vaccinations_petId_idx" ON "vaccinations"("petId");

-- CreateIndex
CREATE INDEX "vaccinations_status_idx" ON "vaccinations"("status");

-- CreateIndex
CREATE INDEX "vaccinations_nextDueAt_idx" ON "vaccinations"("nextDueAt");

-- CreateIndex
CREATE INDEX "medical_records_petId_idx" ON "medical_records"("petId");

-- CreateIndex
CREATE INDEX "medical_records_vetId_idx" ON "medical_records"("vetId");

-- CreateIndex
CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_dueAt_idx" ON "reminders"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "pets_code_key" ON "pets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pets_microchipId_key" ON "pets"("microchipId");

-- CreateIndex
CREATE INDEX "pets_areaId_idx" ON "pets"("areaId");

-- CreateIndex
CREATE INDEX "pets_species_idx" ON "pets"("species");

-- CreateIndex
CREATE INDEX "users_areaId_idx" ON "users"("areaId");

-- CreateIndex
CREATE INDEX "vets_clinicId_idx" ON "vets"("clinicId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "administrative_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrative_areas" ADD CONSTRAINT "administrative_areas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "administrative_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "administrative_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vets" ADD CONSTRAINT "vets_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "administrative_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

