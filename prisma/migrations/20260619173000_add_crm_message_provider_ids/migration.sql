ALTER TABLE "CrmMessage"
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "providerThreadId" TEXT;

CREATE INDEX "CrmMessage_organizationId_ownerUserId_mailboxId_providerThreadId_idx"
  ON "CrmMessage"("organizationId", "ownerUserId", "mailboxId", "providerThreadId");

CREATE UNIQUE INDEX "CrmMessage_organizationId_ownerUserId_mailboxId_providerMessageId_key"
  ON "CrmMessage"("organizationId", "ownerUserId", "mailboxId", "providerMessageId");
