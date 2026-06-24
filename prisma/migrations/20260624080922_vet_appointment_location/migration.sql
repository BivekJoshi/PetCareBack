-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "vets" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
