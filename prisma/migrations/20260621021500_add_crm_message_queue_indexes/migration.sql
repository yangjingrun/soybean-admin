-- Covers CRM send scheduler due-message scans and stale queued-message reconciliation.
CREATE INDEX "CrmMessage_status_scheduledAt_updatedAt_idx"
ON "CrmMessage"("status", "scheduledAt", "updatedAt");

CREATE INDEX "CrmMessage_status_bullJobId_scheduledAt_updatedAt_idx"
ON "CrmMessage"("status", "bullJobId", "scheduledAt", "updatedAt");
