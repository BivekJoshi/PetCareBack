-- CreateTable
CREATE TABLE "message_retention_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "retentionDays" INTEGER NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastPurgeAt" TIMESTAMP(3),
    "lastPurgeCount" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_retention_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "message_retention_settings" ADD CONSTRAINT "message_retention_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton policy row with the default 50-day window.
INSERT INTO "message_retention_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
