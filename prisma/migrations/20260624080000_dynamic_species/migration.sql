-- Convert pets.species from the fixed "PetSpecies" enum to a free-text key that
-- references the new admin-managed "species" catalogue. Existing values (DOG,
-- CAT, …) are preserved by casting the enum to text.
ALTER TABLE "pets" ALTER COLUMN "species" DROP DEFAULT;
ALTER TABLE "pets" ALTER COLUMN "species" SET DATA TYPE TEXT USING "species"::text;
ALTER TABLE "pets" ALTER COLUMN "species" SET DEFAULT 'DOG';

-- The enum type is no longer used.
DROP TYPE "PetSpecies";

-- CreateTable: the species catalogue.
CREATE TABLE "species" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🐾',
    "tint" TEXT NOT NULL DEFAULT '#0E9594',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "species_key_key" ON "species"("key");

-- CreateIndex
CREATE INDEX "species_isActive_idx" ON "species"("isActive");
