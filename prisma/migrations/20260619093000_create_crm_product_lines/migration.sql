CREATE TABLE "CrmProductLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetCustomerType" TEXT,
  "coreSellingPoints" TEXT,
  "moq" TEXT,
  "leadTime" TEXT,
  "paymentTerms" TEXT,
  "certifications" TEXT,
  "catalogUrl" TEXT,
  "websiteUrl" TEXT,
  "commonModelsText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmProductLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmProductLine_organizationId_name_key" ON "CrmProductLine"("organizationId", "name");
CREATE INDEX "CrmProductLine_organizationId_status_updatedAt_idx" ON "CrmProductLine"("organizationId", "status", "updatedAt");
CREATE INDEX "CrmProductLine_organizationId_updatedAt_idx" ON "CrmProductLine"("organizationId", "updatedAt");

ALTER TABLE "CrmProductLine"
ADD CONSTRAINT "CrmProductLine_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
