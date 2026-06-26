-- CreateTable
CREATE TABLE "AiPromptVersion" (
    "id" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "lifecycle" TEXT NOT NULL DEFAULT 'draft',
    "systemPrompt" TEXT NOT NULL,
    "validationResult" JSONB,
    "changeNote" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptTestRun" (
    "id" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "inputPrompt" TEXT NOT NULL,
    "outputText" TEXT,
    "validationResult" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptVersion_promptKey_version_key" ON "AiPromptVersion"("promptKey", "version");

-- CreateIndex
CREATE INDEX "AiPromptVersion_promptKey_lifecycle_updatedAt_idx" ON "AiPromptVersion"("promptKey", "lifecycle", "updatedAt");

-- CreateIndex
CREATE INDEX "AiPromptVersion_promptKey_version_idx" ON "AiPromptVersion"("promptKey", "version");

-- CreateIndex
CREATE INDEX "AiPromptTestRun_promptKey_createdAt_idx" ON "AiPromptTestRun"("promptKey", "createdAt");

-- CreateIndex
CREATE INDEX "AiPromptTestRun_success_createdAt_idx" ON "AiPromptTestRun"("success", "createdAt");
