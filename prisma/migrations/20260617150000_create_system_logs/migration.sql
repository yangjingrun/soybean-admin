CREATE TABLE "SystemLog" (
  "id" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "userId" TEXT,
  "userName" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");
