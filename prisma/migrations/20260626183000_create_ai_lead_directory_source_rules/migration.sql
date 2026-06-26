CREATE TABLE "AiLeadDirectorySourceRule" (
  "id" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "matchMode" TEXT NOT NULL DEFAULT 'domain_suffix',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiLeadDirectorySourceRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiLeadDirectorySourceRule_value_matchMode_key"
  ON "AiLeadDirectorySourceRule"("value", "matchMode");

CREATE INDEX "AiLeadDirectorySourceRule_enabled_idx"
  ON "AiLeadDirectorySourceRule"("enabled");
