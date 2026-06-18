-- Create CRM inbox tables for customer replies synced from Gmail or mock ingestion.
CREATE TABLE "CrmInboxThread" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "mailboxId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'gmail',
  "providerThreadId" TEXT,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "lastInboundAt" TIMESTAMP(3) NOT NULL,
  "unreadCount" INTEGER NOT NULL DEFAULT 1,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmInboxThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmInboxMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "mailboxId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'gmail',
  "providerMessageId" TEXT,
  "replyToMessageId" TEXT,
  "fromEmail" TEXT NOT NULL,
  "fromEmailHash" TEXT NOT NULL,
  "maskedFromEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "snippet" TEXT,
  "bodyText" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "messageType" TEXT NOT NULL DEFAULT 'customer_reply',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmInboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmInboxThread_mailboxId_providerThreadId_key" ON "CrmInboxThread"("mailboxId", "providerThreadId");
CREATE INDEX "CrmInboxThread_organizationId_ownerUserId_status_lastInboundAt_idx" ON "CrmInboxThread"("organizationId", "ownerUserId", "status", "lastInboundAt");
CREATE INDEX "CrmInboxThread_organizationId_accountId_lastInboundAt_idx" ON "CrmInboxThread"("organizationId", "accountId", "lastInboundAt");
CREATE INDEX "CrmInboxThread_organizationId_contactId_lastInboundAt_idx" ON "CrmInboxThread"("organizationId", "contactId", "lastInboundAt");
CREATE INDEX "CrmInboxThread_enrollmentId_idx" ON "CrmInboxThread"("enrollmentId");

CREATE UNIQUE INDEX "CrmInboxMessage_mailboxId_providerMessageId_key" ON "CrmInboxMessage"("mailboxId", "providerMessageId");
CREATE INDEX "CrmInboxMessage_organizationId_ownerUserId_receivedAt_idx" ON "CrmInboxMessage"("organizationId", "ownerUserId", "receivedAt");
CREATE INDEX "CrmInboxMessage_organizationId_accountId_receivedAt_idx" ON "CrmInboxMessage"("organizationId", "accountId", "receivedAt");
CREATE INDEX "CrmInboxMessage_organizationId_contactId_receivedAt_idx" ON "CrmInboxMessage"("organizationId", "contactId", "receivedAt");
CREATE INDEX "CrmInboxMessage_threadId_receivedAt_idx" ON "CrmInboxMessage"("threadId", "receivedAt");
CREATE INDEX "CrmInboxMessage_enrollmentId_idx" ON "CrmInboxMessage"("enrollmentId");

ALTER TABLE "CrmInboxThread" ADD CONSTRAINT "CrmInboxThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmInboxThread" ADD CONSTRAINT "CrmInboxThread_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmInboxThread" ADD CONSTRAINT "CrmInboxThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmInboxThread" ADD CONSTRAINT "CrmInboxThread_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CrmSequenceEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmInboxThread" ADD CONSTRAINT "CrmInboxThread_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CrmMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmInboxMessage" ADD CONSTRAINT "CrmInboxMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CrmInboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmInboxMessage" ADD CONSTRAINT "CrmInboxMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmInboxMessage" ADD CONSTRAINT "CrmInboxMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmInboxMessage" ADD CONSTRAINT "CrmInboxMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmInboxMessage" ADD CONSTRAINT "CrmInboxMessage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CrmSequenceEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmInboxMessage" ADD CONSTRAINT "CrmInboxMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CrmMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
