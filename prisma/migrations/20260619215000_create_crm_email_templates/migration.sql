CREATE TABLE "CrmEmailTemplateGroup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmEmailTemplateGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmEmailTemplateStep" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "templateGroupId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "threadMode" TEXT NOT NULL,
  "delayDays" INTEGER NOT NULL DEFAULT 0,
  "subjectTemplate" TEXT NOT NULL,
  "bodyTemplate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmEmailTemplateStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmEmailTemplateGroup_organizationId_name_key" ON "CrmEmailTemplateGroup"("organizationId", "name");
CREATE INDEX "CrmEmailTemplateGroup_organizationId_status_updatedAt_idx" ON "CrmEmailTemplateGroup"("organizationId", "status", "updatedAt");
CREATE INDEX "CrmEmailTemplateGroup_organizationId_updatedAt_idx" ON "CrmEmailTemplateGroup"("organizationId", "updatedAt");
CREATE INDEX "CrmEmailTemplateGroup_organizationId_isDefault_idx" ON "CrmEmailTemplateGroup"("organizationId", "isDefault");

CREATE UNIQUE INDEX "CrmEmailTemplateStep_templateGroupId_stepIndex_key" ON "CrmEmailTemplateStep"("templateGroupId", "stepIndex");
CREATE INDEX "CrmEmailTemplateStep_organizationId_templateGroupId_idx" ON "CrmEmailTemplateStep"("organizationId", "templateGroupId");

ALTER TABLE "CrmEmailTemplateGroup"
  ADD CONSTRAINT "CrmEmailTemplateGroup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmEmailTemplateStep"
  ADD CONSTRAINT "CrmEmailTemplateStep_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmEmailTemplateStep"
  ADD CONSTRAINT "CrmEmailTemplateStep_templateGroupId_fkey"
  FOREIGN KEY ("templateGroupId") REFERENCES "CrmEmailTemplateGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
