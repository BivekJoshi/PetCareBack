-- DropIndex
DROP INDEX "services_name_key";

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "vetId" TEXT;

-- CreateIndex
CREATE INDEX "services_vetId_idx" ON "services"("vetId");

-- CreateIndex
CREATE UNIQUE INDEX "services_vetId_name_key" ON "services"("vetId", "name");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

