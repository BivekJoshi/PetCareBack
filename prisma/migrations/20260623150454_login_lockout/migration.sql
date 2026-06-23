-- AlterTable
ALTER TABLE "auth_settings" ADD COLUMN     "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "lockoutEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockoutMaxAttempts" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
