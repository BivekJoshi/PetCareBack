-- AlterTable: OAuth accounts have no password; add Google linkage + avatar.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "avatarUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
