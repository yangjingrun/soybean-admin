ALTER TABLE "CrmMailbox"
ADD COLUMN "syncIssueType" TEXT,
ADD COLUMN "syncIssueAt" TIMESTAMP(3),
ADD COLUMN "syncIssueMessage" TEXT;
