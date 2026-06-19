-- CreateTable
CREATE TABLE "CrmProductLineAiPromptVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productLineId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "aiWritingConfig" JSONB,
    "editorId" TEXT NOT NULL,
    "editorName" TEXT,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmProductLineAiPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmProductLineAiPromptVersion_productLineId_version_key" ON "CrmProductLineAiPromptVersion"("productLineId", "version");

-- CreateIndex
CREATE INDEX "CrmProductLineAiPromptVersion_organizationId_productLineId_version_idx" ON "CrmProductLineAiPromptVersion"("organizationId", "productLineId", "version");

-- CreateIndex
CREATE INDEX "CrmProductLineAiPromptVersion_organizationId_createdAt_idx" ON "CrmProductLineAiPromptVersion"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CrmProductLineAiPromptVersion" ADD CONSTRAINT "CrmProductLineAiPromptVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmProductLineAiPromptVersion" ADD CONSTRAINT "CrmProductLineAiPromptVersion_productLineId_fkey" FOREIGN KEY ("productLineId") REFERENCES "CrmProductLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
