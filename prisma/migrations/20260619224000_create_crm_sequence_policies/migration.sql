CREATE TABLE "CrmSequencePolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "stepDelayDaysText" TEXT NOT NULL DEFAULT '0,3,7,14,21',
  "stepThreadModesText" TEXT NOT NULL DEFAULT 'new_subject,same_thread,new_subject,new_subject,new_subject',
  "linkPolicy" TEXT NOT NULL DEFAULT 'preserve_template_links',
  "allowLowRiskAutoSend" BOOLEAN NOT NULL DEFAULT false,
  "sameCompanyContactStrategy" TEXT NOT NULL DEFAULT 'single_active_per_company',
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmSequencePolicy_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmSequenceEnrollment" ADD COLUMN "policyId" TEXT;

CREATE UNIQUE INDEX "CrmSequencePolicy_organizationId_name_key" ON "CrmSequencePolicy"("organizationId", "name");
CREATE INDEX "CrmSequencePolicy_organizationId_status_updatedAt_idx" ON "CrmSequencePolicy"("organizationId", "status", "updatedAt");
CREATE INDEX "CrmSequencePolicy_organizationId_isDefault_idx" ON "CrmSequencePolicy"("organizationId", "isDefault");
CREATE INDEX "CrmSequenceEnrollment_organizationId_policyId_idx" ON "CrmSequenceEnrollment"("organizationId", "policyId");

ALTER TABLE "CrmSequencePolicy"
  ADD CONSTRAINT "CrmSequencePolicy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmSequenceEnrollment"
  ADD CONSTRAINT "CrmSequenceEnrollment_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "CrmSequencePolicy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
