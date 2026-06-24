-- CreateEnum
CREATE TYPE "RoleRequestFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- AlterTable
ALTER TABLE "role_change_requests" ADD COLUMN     "fieldValues" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "role_request_fields" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "RoleRequestFieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "placeholder" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_request_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_request_fields_role_idx" ON "role_request_fields"("role");

-- CreateIndex
CREATE UNIQUE INDEX "role_request_fields_role_key_key" ON "role_request_fields"("role", "key");
