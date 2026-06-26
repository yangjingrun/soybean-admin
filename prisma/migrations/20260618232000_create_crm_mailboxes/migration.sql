CREATE TABLE "CrmMailbox" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "ownerUserName" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'gmail',
  "emailAddress" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "maskedEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "dailyLimit" INTEGER NOT NULL DEFAULT 50,
  "hourlyLimit" INTEGER NOT NULL DEFAULT 10,
  "warmupStage" TEXT NOT NULL DEFAULT 'new',
  "watchExpiration" TIMESTAMP(3),
  "lastHistoryId" TEXT,
  "authorizedAt" TIMESTAMP(3) NOT NULL,
  "pausedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmMailbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmMailbox_provider_emailHash_key" ON "CrmMailbox"("provider", "emailHash");
CREATE INDEX "CrmMailbox_organizationId_ownerUserId_updatedAt_idx" ON "CrmMailbox"("organizationId", "ownerUserId", "updatedAt");
CREATE INDEX "CrmMailbox_organizationId_status_updatedAt_idx" ON "CrmMailbox"("organizationId", "status", "updatedAt");
CREATE INDEX "CrmMailbox_provider_status_idx" ON "CrmMailbox"("provider", "status");

ALTER TABLE "CrmMailbox"
ADD CONSTRAINT "CrmMailbox_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
