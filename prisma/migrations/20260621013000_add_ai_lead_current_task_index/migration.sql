-- Covers current-task restore and create guard queries by user, organization, status, and updatedAt.
CREATE INDEX "AiLeadSearchTask_userId_organizationId_status_updatedAt_idx"
ON "AiLeadSearchTask"("userId", "organizationId", "status", "updatedAt");
