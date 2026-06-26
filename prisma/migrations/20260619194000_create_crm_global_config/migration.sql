CREATE TABLE "CrmGlobalConfig" (
  "id" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "emailVerificationCooldownDays" INTEGER NOT NULL DEFAULT 30,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmGlobalConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmGlobalConfig_configKey_key" ON "CrmGlobalConfig"("configKey");
