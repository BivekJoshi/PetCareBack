-- CreateEnum
CREATE TYPE "RoleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "role_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentRole" "Role" NOT NULL,
    "requestedRole" "Role" NOT NULL,
    "reason" TEXT,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "status" "RoleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_change_requests_userId_idx" ON "role_change_requests"("userId");

-- CreateIndex
CREATE INDEX "role_change_requests_status_idx" ON "role_change_requests"("status");

-- AddForeignKey
ALTER TABLE "role_change_requests" ADD CONSTRAINT "role_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_change_requests" ADD CONSTRAINT "role_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
