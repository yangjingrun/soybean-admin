-- Scope Gmail provider ids by tenant owner before storing mailbox send usage.
DROP INDEX IF EXISTS "CrmInboxThread_mailboxId_providerThreadId_key";
DROP INDEX IF EXISTS "CrmInboxMessage_mailboxId_providerMessageId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "CrmInboxThread_organizationId_ownerUserId_mailboxId_providerThreadId_key" ON "CrmInboxThread"("organizationId", "ownerUserId", "mailboxId", "providerThreadId");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmInboxMessage_organizationId_ownerUserId_mailboxId_providerMessageId_key" ON "CrmInboxMessage"("organizationId", "ownerUserId", "mailboxId", "providerMessageId");

-- Track CRM mailbox send attempts by UTC day/hour bucket for quota enforcement.
CREATE TABLE "CrmMailboxSendUsage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "bucketType" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmMailboxSendUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmMailboxSendUsage_mailboxId_bucketType_bucketKey_key" ON "CrmMailboxSendUsage"("mailboxId", "bucketType", "bucketKey");
CREATE INDEX "CrmMailboxSendUsage_organizationId_mailboxId_bucketType_bucketKey_idx" ON "CrmMailboxSendUsage"("organizationId", "mailboxId", "bucketType", "bucketKey");

ALTER TABLE "CrmMailboxSendUsage" ADD CONSTRAINT "CrmMailboxSendUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmMailboxSendUsage" ADD CONSTRAINT "CrmMailboxSendUsage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CrmMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
