CREATE TABLE "CrmAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "domain" TEXT,
  "country" TEXT,
  "customerType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'candidate',
  "sourceTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmContact" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "fullName" TEXT,
  "title" TEXT,
  "email" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "maskedEmail" TEXT NOT NULL,
  "isPublicEmail" BOOLEAN NOT NULL DEFAULT false,
  "emailStatus" TEXT NOT NULL DEFAULT 'unchecked',
  "sourceTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmTimelineEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT,
  "ownerUserId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmAccount_organizationId_ownerUserId_domain_key" ON "CrmAccount"("organizationId", "ownerUserId", "domain");
CREATE INDEX "CrmAccount_organizationId_ownerUserId_updatedAt_idx" ON "CrmAccount"("organizationId", "ownerUserId", "updatedAt");
CREATE INDEX "CrmAccount_organizationId_status_updatedAt_idx" ON "CrmAccount"("organizationId", "status", "updatedAt");
CREATE INDEX "CrmAccount_sourceTaskId_idx" ON "CrmAccount"("sourceTaskId");

CREATE UNIQUE INDEX "CrmContact_organizationId_ownerUserId_emailHash_key" ON "CrmContact"("organizationId", "ownerUserId", "emailHash");
CREATE INDEX "CrmContact_organizationId_accountId_idx" ON "CrmContact"("organizationId", "accountId");
CREATE INDEX "CrmContact_organizationId_ownerUserId_updatedAt_idx" ON "CrmContact"("organizationId", "ownerUserId", "updatedAt");
CREATE INDEX "CrmContact_organizationId_emailStatus_idx" ON "CrmContact"("organizationId", "emailStatus");
CREATE INDEX "CrmContact_sourceTaskId_idx" ON "CrmContact"("sourceTaskId");

CREATE INDEX "CrmTimelineEvent_organizationId_accountId_createdAt_idx" ON "CrmTimelineEvent"("organizationId", "accountId", "createdAt");
CREATE INDEX "CrmTimelineEvent_organizationId_contactId_createdAt_idx" ON "CrmTimelineEvent"("organizationId", "contactId", "createdAt");
CREATE INDEX "CrmTimelineEvent_eventType_createdAt_idx" ON "CrmTimelineEvent"("eventType", "createdAt");

ALTER TABLE "CrmAccount"
ADD CONSTRAINT "CrmAccount_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmContact"
ADD CONSTRAINT "CrmContact_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmContact"
ADD CONSTRAINT "CrmContact_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmTimelineEvent"
ADD CONSTRAINT "CrmTimelineEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmTimelineEvent"
ADD CONSTRAINT "CrmTimelineEvent_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmTimelineEvent"
ADD CONSTRAINT "CrmTimelineEvent_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
