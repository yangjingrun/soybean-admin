ALTER TABLE "CrmAccount"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "timeZone" TEXT;

ALTER TABLE "CrmMessage"
  ADD COLUMN "recipientTimeZone" TEXT;
