ALTER TABLE "CrmGlobalConfig"
  ALTER COLUMN "followUpDelayDaysText" SET DEFAULT '3,7,12,18';

ALTER TABLE "CrmSequencePolicy"
  ALTER COLUMN "stepDelayDaysText" SET DEFAULT '0,3,7,12,18';
