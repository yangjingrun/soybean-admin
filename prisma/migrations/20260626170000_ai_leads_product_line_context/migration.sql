ALTER TABLE "AiLeadSearchTask"
  ADD COLUMN "productLineId" TEXT,
  ADD COLUMN "productLineSnapshot" JSONB;

CREATE INDEX "AiLeadSearchTask_organizationId_productLineId_updatedAt_idx"
  ON "AiLeadSearchTask"("organizationId", "productLineId", "updatedAt");
