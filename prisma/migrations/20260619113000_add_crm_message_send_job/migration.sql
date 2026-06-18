-- Add BullMQ job tracking for guarded CRM email sending.
ALTER TABLE "CrmMessage" ADD COLUMN "bullJobId" TEXT;

CREATE INDEX "CrmMessage_organizationId_bullJobId_idx" ON "CrmMessage"("organizationId", "bullJobId");
