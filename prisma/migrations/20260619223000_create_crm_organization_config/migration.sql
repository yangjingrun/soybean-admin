CREATE TABLE "CrmOrganizationConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "allowAdminViewMemberEmailBody" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmOrganizationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmOrganizationConfig_organizationId_key" ON "CrmOrganizationConfig"("organizationId");
CREATE INDEX "CrmOrganizationConfig_updatedAt_idx" ON "CrmOrganizationConfig"("updatedAt");

ALTER TABLE "CrmOrganizationConfig"
  ADD CONSTRAINT "CrmOrganizationConfig_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
