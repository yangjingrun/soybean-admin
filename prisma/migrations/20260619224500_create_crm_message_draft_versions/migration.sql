CREATE TABLE "CrmMessageDraftVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "mailboxId" TEXT,
  "stepIndex" INTEGER NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "editorId" TEXT NOT NULL,
  "editorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmMessageDraftVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmMessageDraftVersion_messageId_versionNo_key"
  ON "CrmMessageDraftVersion"("messageId", "versionNo");

CREATE INDEX "CrmMessageDraftVersion_organizationId_ownerUserId_messageId_versionNo_idx"
  ON "CrmMessageDraftVersion"("organizationId", "ownerUserId", "messageId", "versionNo");

CREATE INDEX "CrmMessageDraftVersion_organizationId_enrollmentId_stepIndex_idx"
  ON "CrmMessageDraftVersion"("organizationId", "enrollmentId", "stepIndex");

CREATE INDEX "CrmMessageDraftVersion_createdAt_idx"
  ON "CrmMessageDraftVersion"("createdAt");

ALTER TABLE "CrmMessageDraftVersion"
  ADD CONSTRAINT "CrmMessageDraftVersion_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmMessageDraftVersion"
  ADD CONSTRAINT "CrmMessageDraftVersion_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmMessageDraftVersion"
  ADD CONSTRAINT "CrmMessageDraftVersion_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmMessageDraftVersion"
  ADD CONSTRAINT "CrmMessageDraftVersion_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "CrmSequenceEnrollment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmMessageDraftVersion"
  ADD CONSTRAINT "CrmMessageDraftVersion_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "CrmMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmMessageDraftVersion"
  ADD CONSTRAINT "CrmMessageDraftVersion_mailboxId_fkey"
  FOREIGN KEY ("mailboxId") REFERENCES "CrmMailbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
