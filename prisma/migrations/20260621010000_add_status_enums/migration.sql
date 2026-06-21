-- Preflight before deploying to an existing environment:
-- SELECT status, count(*) FROM "AiLeadSearchTask" WHERE status NOT IN ('queued', 'running', 'interrupted', 'failed', 'completed', 'discarded') GROUP BY status;
-- SELECT status, count(*) FROM "AiLeadSearchTaskQuery" WHERE status NOT IN ('pending', 'running', 'completed', 'failed') GROUP BY status;
-- SELECT status, count(*) FROM "CrmSequenceEnrollment" WHERE status NOT IN ('draft_review_pending', 'ready_to_send', 'sequence_running', 'paused', 'stopped', 'replied', 'archived') GROUP BY status;
-- SELECT status, count(*) FROM "CrmMessage" WHERE status NOT IN ('draft_pending_review', 'draft_ready', 'queued', 'sent', 'failed', 'skipped') GROUP BY status;
-- SELECT status, count(*) FROM "CrmAiDraftTask" WHERE status NOT IN ('queued', 'running', 'completed', 'failed', 'cancelled') GROUP BY status;
-- SELECT status, count(*) FROM "CrmAiDraftTaskItem" WHERE status NOT IN ('pending', 'running', 'retrying', 'succeeded', 'skipped', 'failed') GROUP BY status;

CREATE TYPE "AiLeadSearchTaskStatus" AS ENUM ('queued', 'running', 'interrupted', 'failed', 'completed', 'discarded');
CREATE TYPE "AiLeadSearchTaskQueryStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "CrmSequenceEnrollmentStatus" AS ENUM ('draft_review_pending', 'ready_to_send', 'sequence_running', 'paused', 'stopped', 'replied', 'archived');
CREATE TYPE "CrmMessageStatus" AS ENUM ('draft_pending_review', 'draft_ready', 'queued', 'sent', 'failed', 'skipped');
CREATE TYPE "CrmAiDraftTaskStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "CrmAiDraftTaskItemStatus" AS ENUM ('pending', 'running', 'retrying', 'succeeded', 'skipped', 'failed');

-- The partial index compares status with text literals. Recreate it after status becomes an enum.
DROP INDEX IF EXISTS "CrmSequenceEnrollment_active_contact_unique_idx";

ALTER TABLE "AiLeadSearchTask"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AiLeadSearchTaskStatus" USING "status"::"AiLeadSearchTaskStatus",
  ALTER COLUMN "status" SET DEFAULT 'queued';

ALTER TABLE "AiLeadSearchTaskQuery"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AiLeadSearchTaskQueryStatus" USING "status"::"AiLeadSearchTaskQueryStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "CrmSequenceEnrollment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CrmSequenceEnrollmentStatus" USING "status"::"CrmSequenceEnrollmentStatus",
  ALTER COLUMN "status" SET DEFAULT 'draft_review_pending';

ALTER TABLE "CrmMessage"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CrmMessageStatus" USING "status"::"CrmMessageStatus",
  ALTER COLUMN "status" SET DEFAULT 'draft_pending_review';

ALTER TABLE "CrmAiDraftTask"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CrmAiDraftTaskStatus" USING "status"::"CrmAiDraftTaskStatus",
  ALTER COLUMN "status" SET DEFAULT 'queued';

ALTER TABLE "CrmAiDraftTaskItem"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CrmAiDraftTaskItemStatus" USING "status"::"CrmAiDraftTaskItemStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE UNIQUE INDEX "CrmSequenceEnrollment_active_contact_unique_idx"
  ON "CrmSequenceEnrollment"("organizationId", "ownerUserId", "contactId")
  WHERE "status" IN (
    'draft_review_pending'::"CrmSequenceEnrollmentStatus",
    'ready_to_send'::"CrmSequenceEnrollmentStatus",
    'sequence_running'::"CrmSequenceEnrollmentStatus",
    'paused'::"CrmSequenceEnrollmentStatus"
  );
