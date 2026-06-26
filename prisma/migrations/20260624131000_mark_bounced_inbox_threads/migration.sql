UPDATE "CrmInboxThread" AS thread
SET
  "status" = 'bounced',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  thread."status" IN ('pending', 'handled')
  AND EXISTS (
    SELECT 1
    FROM "CrmInboxMessage" AS message
    WHERE
      message."threadId" = thread."id"
      AND message."messageType" = 'bounce'
  );
