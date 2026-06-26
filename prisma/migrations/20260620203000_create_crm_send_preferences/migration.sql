ALTER TABLE "CrmGlobalConfig"
ADD COLUMN "ownerDailySendLimitMax" INTEGER NOT NULL DEFAULT 200;

CREATE TABLE "CrmUserSendPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerUserName" TEXT,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 50,
    "followUpSharePercent" INTEGER NOT NULL DEFAULT 70,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmUserSendPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmUserSendPreference_organizationId_ownerUserId_key"
ON "CrmUserSendPreference"("organizationId", "ownerUserId");

CREATE INDEX "CrmUserSendPreference_organizationId_updatedAt_idx"
ON "CrmUserSendPreference"("organizationId", "updatedAt");

ALTER TABLE "CrmUserSendPreference"
ADD CONSTRAINT "CrmUserSendPreference_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
