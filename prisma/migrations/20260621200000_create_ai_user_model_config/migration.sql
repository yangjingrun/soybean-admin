CREATE TABLE "AiUserModelConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "apiBase" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "encryptedApiKey" TEXT,
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION,
  "maxOutputTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiUserModelConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiUserModelConfig_userId_key" ON "AiUserModelConfig"("userId");

ALTER TABLE "AiUserModelConfig"
  ADD CONSTRAINT "AiUserModelConfig_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "SystemUser"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
