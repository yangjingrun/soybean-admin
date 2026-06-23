CREATE TABLE "CrmEmailOpenEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "openCount" INTEGER NOT NULL DEFAULT 1,
  "firstOpenedAt" TIMESTAMP(3) NOT NULL,
  "lastOpenedAt" TIMESTAMP(3) NOT NULL,
  "lastUserAgent" TEXT,
  "lastIpAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmEmailOpenEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmEmailOpenEvent_messageId_key" ON "CrmEmailOpenEvent"("messageId");
CREATE INDEX "CrmEmailOpenEvent_organizationId_ownerUserId_lastOpenedAt_idx" ON "CrmEmailOpenEvent"("organizationId", "ownerUserId", "lastOpenedAt");
CREATE INDEX "CrmEmailOpenEvent_organizationId_accountId_lastOpenedAt_idx" ON "CrmEmailOpenEvent"("organizationId", "accountId", "lastOpenedAt");
CREATE INDEX "CrmEmailOpenEvent_organizationId_contactId_lastOpenedAt_idx" ON "CrmEmailOpenEvent"("organizationId", "contactId", "lastOpenedAt");

ALTER TABLE "CrmEmailOpenEvent"
ADD CONSTRAINT "CrmEmailOpenEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmEmailOpenEvent"
ADD CONSTRAINT "CrmEmailOpenEvent_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmEmailOpenEvent"
ADD CONSTRAINT "CrmEmailOpenEvent_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmEmailOpenEvent"
ADD CONSTRAINT "CrmEmailOpenEvent_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "CrmSequenceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmEmailOpenEvent"
ADD CONSTRAINT "CrmEmailOpenEvent_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "CrmMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
