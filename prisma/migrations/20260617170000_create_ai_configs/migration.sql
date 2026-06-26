CREATE TABLE "AiPromptConfig" (
  "id" TEXT NOT NULL,
  "promptKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiPromptConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiModelConfig" (
  "id" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "apiBase" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION,
  "maxOutputTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiModelConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiPromptConfig_promptKey_key" ON "AiPromptConfig"("promptKey");
CREATE UNIQUE INDEX "AiModelConfig_configKey_key" ON "AiModelConfig"("configKey");
