CREATE TABLE "CrmArchivedFingerprint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fingerprintType" TEXT NOT NULL,
  "fingerprintValue" TEXT NOT NULL,
  "maskedValue" TEXT,
  "accountName" TEXT,
  "normalizedName" TEXT,
  "country" TEXT,
  "sourceAccountId" TEXT,
  "sourceContactId" TEXT,
  "sourceTaskId" TEXT,
  "archiveReason" TEXT,
  "archivedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmArchivedFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmArchivedFingerprint_organizationId_fingerprintType_fingerprintValue_key" ON "CrmArchivedFingerprint"("organizationId", "fingerprintType", "fingerprintValue");
CREATE INDEX "CrmArchivedFingerprint_organizationId_fingerprintType_archivedAt_idx" ON "CrmArchivedFingerprint"("organizationId", "fingerprintType", "archivedAt");
CREATE INDEX "CrmArchivedFingerprint_organizationId_archivedAt_idx" ON "CrmArchivedFingerprint"("organizationId", "archivedAt");
CREATE INDEX "CrmArchivedFingerprint_sourceAccountId_idx" ON "CrmArchivedFingerprint"("sourceAccountId");
CREATE INDEX "CrmArchivedFingerprint_sourceContactId_idx" ON "CrmArchivedFingerprint"("sourceContactId");

ALTER TABLE "CrmArchivedFingerprint" ADD CONSTRAINT "CrmArchivedFingerprint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
