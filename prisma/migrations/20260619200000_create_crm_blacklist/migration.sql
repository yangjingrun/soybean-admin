CREATE TABLE "CrmBlacklist" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "maskedEmail" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceAccountId" TEXT,
  "sourceContactId" TEXT,
  "sourceMessageId" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmBlacklist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmBlacklist_organizationId_emailHash_key" ON "CrmBlacklist"("organizationId", "emailHash");
CREATE INDEX "CrmBlacklist_organizationId_reason_updatedAt_idx" ON "CrmBlacklist"("organizationId", "reason", "updatedAt");
CREATE INDEX "CrmBlacklist_organizationId_updatedAt_idx" ON "CrmBlacklist"("organizationId", "updatedAt");

ALTER TABLE "CrmBlacklist" ADD CONSTRAINT "CrmBlacklist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
