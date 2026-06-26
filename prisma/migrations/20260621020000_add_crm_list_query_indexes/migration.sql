-- Covers CRM list queries that combine tenant/owner filters with status or mailbox filters and time ordering.
CREATE INDEX "CrmAccount_organizationId_ownerUserId_status_updatedAt_idx"
ON "CrmAccount"("organizationId", "ownerUserId", "status", "updatedAt");

CREATE INDEX "CrmSequenceEnrollment_organizationId_updatedAt_idx"
ON "CrmSequenceEnrollment"("organizationId", "updatedAt");
CREATE INDEX "CrmSequenceEnrollment_organizationId_status_updatedAt_idx"
ON "CrmSequenceEnrollment"("organizationId", "status", "updatedAt");

CREATE INDEX "CrmInboxThread_organizationId_lastInboundAt_idx"
ON "CrmInboxThread"("organizationId", "lastInboundAt");
CREATE INDEX "CrmInboxThread_organizationId_mailboxId_lastInboundAt_idx"
ON "CrmInboxThread"("organizationId", "mailboxId", "lastInboundAt");
CREATE INDEX "CrmInboxThread_organizationId_ownerUserId_mailboxId_lastInboundAt_idx"
ON "CrmInboxThread"("organizationId", "ownerUserId", "mailboxId", "lastInboundAt");
