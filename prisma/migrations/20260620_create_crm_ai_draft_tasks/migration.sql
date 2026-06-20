-- CreateTable
CREATE TABLE "CrmAiDraftTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationRole" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "ownerUserName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "runVersion" INTEGER NOT NULL DEFAULT 1,
    "bullJobId" TEXT,
    "requestedCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "retryingCount" INTEGER NOT NULL DEFAULT 0,
    "runningCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "effectiveConcurrency" INTEGER NOT NULL DEFAULT 3,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "failureReason" TEXT,
    "progressState" JSONB,
    "resultSummary" JSONB,
    "readAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAiDraftTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmAiDraftTaskItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "messageId" TEXT,
    "contactId" TEXT,
    "accountId" TEXT,
    "productLineId" TEXT,
    "stepIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "failureType" TEXT,
    "failureReason" TEXT,
    "draftSubject" TEXT,
    "draftBodyText" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAiDraftTaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmAiDraftQueueConfig" (
    "configKey" TEXT NOT NULL DEFAULT 'crm-ai-draft',
    "itemConcurrency" INTEGER NOT NULL DEFAULT 3,
    "maxItemConcurrency" INTEGER NOT NULL DEFAULT 5,
    "maxActiveTasksPerUser" INTEGER NOT NULL DEFAULT 1,
    "maxActiveTasksPerOrg" INTEGER NOT NULL DEFAULT 2,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffSeconds" JSONB,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAiDraftQueueConfig_pkey" PRIMARY KEY ("configKey")
);

-- CreateIndex
CREATE INDEX "CrmAiDraftTask_organizationId_ownerUserId_status_updatedAt_idx" ON "CrmAiDraftTask"("organizationId", "ownerUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CrmAiDraftTask_organizationId_status_updatedAt_idx" ON "CrmAiDraftTask"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmAiDraftTaskItem_taskId_enrollmentId_stepIndex_key" ON "CrmAiDraftTaskItem"("taskId", "enrollmentId", "stepIndex");

-- CreateIndex
CREATE INDEX "CrmAiDraftTaskItem_taskId_status_updatedAt_idx" ON "CrmAiDraftTaskItem"("taskId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CrmAiDraftTaskItem_organizationId_ownerUserId_status_idx" ON "CrmAiDraftTaskItem"("organizationId", "ownerUserId", "status");

-- AddForeignKey
ALTER TABLE "CrmAiDraftTask" ADD CONSTRAINT "CrmAiDraftTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAiDraftTaskItem" ADD CONSTRAINT "CrmAiDraftTaskItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmAiDraftTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAiDraftTaskItem" ADD CONSTRAINT "CrmAiDraftTaskItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
