ALTER TABLE "CrmInboxThread"
ADD COLUMN "replyDraftBodyText" TEXT,
ADD COLUMN "replyDraftTopic" TEXT,
ADD COLUMN "replyDraftMetadata" JSONB,
ADD COLUMN "replyDraftUpdatedAt" TIMESTAMP(3),
ADD COLUMN "replyDraftUpdatedById" TEXT,
ADD COLUMN "replyDraftUpdatedByName" TEXT;
