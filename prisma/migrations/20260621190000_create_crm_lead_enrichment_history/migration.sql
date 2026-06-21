-- CreateTable
CREATE TABLE "CrmLeadEnrichmentHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "accountId" TEXT,
    "contactId" TEXT,
    "provider" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "identityValue" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastAttemptedAt" TIMESTAMP(3) NOT NULL,
    "lastSucceededAt" TIMESTAMP(3),
    "maskedEmail" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLeadEnrichmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmLeadEnrichmentHistory_organizationId_ownerUserId_provider_identityType_identityValue_key" ON "CrmLeadEnrichmentHistory"("organizationId", "ownerUserId", "provider", "identityType", "identityValue");

-- CreateIndex
CREATE INDEX "CrmLeadEnrichmentHistory_organizationId_ownerUserId_identityType_identityValue_idx" ON "CrmLeadEnrichmentHistory"("organizationId", "ownerUserId", "identityType", "identityValue");

-- CreateIndex
CREATE INDEX "CrmLeadEnrichmentHistory_accountId_idx" ON "CrmLeadEnrichmentHistory"("accountId");

-- CreateIndex
CREATE INDEX "CrmLeadEnrichmentHistory_contactId_idx" ON "CrmLeadEnrichmentHistory"("contactId");

-- CreateIndex
CREATE INDEX "CrmAccount_organizationId_ownerUserId_normalizedName_idx" ON "CrmAccount"("organizationId", "ownerUserId", "normalizedName");

-- AddForeignKey
ALTER TABLE "CrmLeadEnrichmentHistory" ADD CONSTRAINT "CrmLeadEnrichmentHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadEnrichmentHistory" ADD CONSTRAINT "CrmLeadEnrichmentHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadEnrichmentHistory" ADD CONSTRAINT "CrmLeadEnrichmentHistory_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
