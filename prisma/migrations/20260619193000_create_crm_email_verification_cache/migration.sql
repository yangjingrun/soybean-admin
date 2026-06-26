CREATE TABLE "CrmEmailVerificationCache" (
  "id" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "maskedEmail" TEXT NOT NULL,
  "domain" TEXT,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "checkedById" TEXT,
  "checkedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmEmailVerificationCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmEmailVerificationCache_emailHash_key" ON "CrmEmailVerificationCache"("emailHash");
CREATE INDEX "CrmEmailVerificationCache_expiresAt_idx" ON "CrmEmailVerificationCache"("expiresAt");
CREATE INDEX "CrmEmailVerificationCache_domain_expiresAt_idx" ON "CrmEmailVerificationCache"("domain", "expiresAt");
