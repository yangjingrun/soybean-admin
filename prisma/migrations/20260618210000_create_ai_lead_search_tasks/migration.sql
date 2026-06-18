CREATE TABLE "AiLeadSearchTask" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "requirement" TEXT NOT NULL,
  "targetLeadCount" INTEGER NOT NULL,
  "keywordPlan" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "runVersion" INTEGER NOT NULL DEFAULT 1,
  "progressState" JSONB,
  "result" JSONB,
  "errorMessage" TEXT,
  "bullJobId" TEXT,
  "readAt" TIMESTAMP(3),
  "notifiedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiLeadSearchTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiLeadSearchTaskQuery" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "requestBody" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "errorMessage" TEXT,
  "orderIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiLeadSearchTaskQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiLeadSearchTaskEvent" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiLeadSearchTaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "module" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "routePath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "shownAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiLeadQueueConfig" (
  "id" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "workerConcurrency" INTEGER NOT NULL DEFAULT 2,
  "priorityStrategy" TEXT NOT NULL DEFAULT 'fifo',
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiLeadQueueConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiLeadSearchTask_userId_status_updatedAt_idx" ON "AiLeadSearchTask"("userId", "status", "updatedAt");
CREATE INDEX "AiLeadSearchTask_status_createdAt_idx" ON "AiLeadSearchTask"("status", "createdAt");
CREATE INDEX "AiLeadSearchTask_bullJobId_idx" ON "AiLeadSearchTask"("bullJobId");

CREATE UNIQUE INDEX "AiLeadSearchTaskQuery_taskId_requestKey_key" ON "AiLeadSearchTaskQuery"("taskId", "requestKey");
CREATE INDEX "AiLeadSearchTaskQuery_taskId_status_orderIndex_idx" ON "AiLeadSearchTaskQuery"("taskId", "status", "orderIndex");

CREATE INDEX "AiLeadSearchTaskEvent_taskId_createdAt_idx" ON "AiLeadSearchTaskEvent"("taskId", "createdAt");
CREATE INDEX "AiLeadSearchTaskEvent_eventType_createdAt_idx" ON "AiLeadSearchTaskEvent"("eventType", "createdAt");

CREATE INDEX "SystemNotification_userId_status_createdAt_idx" ON "SystemNotification"("userId", "status", "createdAt");
CREATE INDEX "SystemNotification_targetType_targetId_idx" ON "SystemNotification"("targetType", "targetId");

CREATE UNIQUE INDEX "AiLeadQueueConfig_configKey_key" ON "AiLeadQueueConfig"("configKey");

ALTER TABLE "AiLeadSearchTaskQuery"
  ADD CONSTRAINT "AiLeadSearchTaskQuery_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "AiLeadSearchTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiLeadSearchTaskEvent"
  ADD CONSTRAINT "AiLeadSearchTaskEvent_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "AiLeadSearchTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
