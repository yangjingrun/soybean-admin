ALTER TABLE "CrmAccount"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archiveReason" TEXT,
  ADD COLUMN "archiveSlimmedAt" TIMESTAMP(3);

CREATE INDEX "CrmAccount_organizationId_status_archivedAt_idx"
  ON "CrmAccount"("organizationId", "status", "archivedAt");
