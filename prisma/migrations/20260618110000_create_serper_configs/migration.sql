CREATE TABLE "SerperConfig" (
  "id" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "apiBase" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SerperConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SerperConfig_configKey_key" ON "SerperConfig"("configKey");
