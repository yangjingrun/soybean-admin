ALTER TABLE "AiLeadSearchTask" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AiLeadSearchTask" ADD COLUMN "organizationRole" TEXT NOT NULL DEFAULT 'member';

UPDATE "AiLeadSearchTask"
SET
  "organizationId" = 'org-default',
  "organizationRole" = 'member'
WHERE "organizationId" IS NULL;

ALTER TABLE "AiLeadSearchTask" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AiLeadSearchTask" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';

CREATE INDEX "AiLeadSearchTask_organizationId_status_updatedAt_idx" ON "AiLeadSearchTask"("organizationId", "status", "updatedAt");

ALTER TABLE "AiLeadSearchTask"
ADD CONSTRAINT "AiLeadSearchTask_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
