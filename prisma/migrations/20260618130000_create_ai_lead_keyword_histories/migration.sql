CREATE TABLE "AiLeadKeywordHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "requirement" TEXT NOT NULL,
  "resultText" TEXT NOT NULL,
  "keywordPlan" JSONB NOT NULL,
  "finishReason" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiLeadKeywordHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiLeadKeywordHistory_userId_updatedAt_idx" ON "AiLeadKeywordHistory"("userId", "updatedAt");
CREATE INDEX "AiLeadKeywordHistory_createdAt_idx" ON "AiLeadKeywordHistory"("createdAt");
