CREATE TABLE "CrmPersonaProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "titleKeywordsText" TEXT,
  "customerTypeKeywordsText" TEXT,
  "painPoints" TEXT,
  "focusText" TEXT,
  "avoidText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmPersonaProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmPersonaProfile_organizationId_name_key" ON "CrmPersonaProfile"("organizationId", "name");
CREATE INDEX "CrmPersonaProfile_organizationId_status_updatedAt_idx" ON "CrmPersonaProfile"("organizationId", "status", "updatedAt");
CREATE INDEX "CrmPersonaProfile_organizationId_isDefault_idx" ON "CrmPersonaProfile"("organizationId", "isDefault");

ALTER TABLE "CrmPersonaProfile"
  ADD CONSTRAINT "CrmPersonaProfile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
