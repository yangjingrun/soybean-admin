CREATE TABLE "CrmSequenceEnrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "productLineId" TEXT,
    "mailboxId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft_review_pending',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL DEFAULT 5,
    "runVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "stepIndex" INTEGER NOT NULL,
    "threadMode" TEXT NOT NULL DEFAULT 'new_subject',
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft_pending_review',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmSequenceEnrollment_organizationId_ownerUserId_status_updatedAt_idx" ON "CrmSequenceEnrollment"("organizationId", "ownerUserId", "status", "updatedAt");
CREATE INDEX "CrmSequenceEnrollment_organizationId_accountId_status_idx" ON "CrmSequenceEnrollment"("organizationId", "accountId", "status");
CREATE INDEX "CrmSequenceEnrollment_organizationId_contactId_status_idx" ON "CrmSequenceEnrollment"("organizationId", "contactId", "status");
CREATE INDEX "CrmSequenceEnrollment_organizationId_ownerUserId_contactId_idx" ON "CrmSequenceEnrollment"("organizationId", "ownerUserId", "contactId");
CREATE UNIQUE INDEX "CrmSequenceEnrollment_active_contact_unique_idx" ON "CrmSequenceEnrollment"("organizationId", "ownerUserId", "contactId") WHERE "status" IN ('draft_review_pending', 'ready_to_send', 'sequence_running', 'paused');

CREATE UNIQUE INDEX "CrmMessage_enrollmentId_stepIndex_key" ON "CrmMessage"("enrollmentId", "stepIndex");
CREATE INDEX "CrmMessage_organizationId_ownerUserId_status_updatedAt_idx" ON "CrmMessage"("organizationId", "ownerUserId", "status", "updatedAt");
CREATE INDEX "CrmMessage_organizationId_accountId_createdAt_idx" ON "CrmMessage"("organizationId", "accountId", "createdAt");
CREATE INDEX "CrmMessage_organizationId_contactId_createdAt_idx" ON "CrmMessage"("organizationId", "contactId", "createdAt");

ALTER TABLE "CrmSequenceEnrollment" ADD CONSTRAINT "CrmSequenceEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmSequenceEnrollment" ADD CONSTRAINT "CrmSequenceEnrollment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmSequenceEnrollment" ADD CONSTRAINT "CrmSequenceEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmSequenceEnrollment" ADD CONSTRAINT "CrmSequenceEnrollment_productLineId_fkey" FOREIGN KEY ("productLineId") REFERENCES "CrmProductLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmSequenceEnrollment" ADD CONSTRAINT "CrmSequenceEnrollment_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CrmMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CrmSequenceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CrmMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
