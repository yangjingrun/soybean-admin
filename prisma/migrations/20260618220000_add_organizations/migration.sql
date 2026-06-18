CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'enabled',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Organization_status_idx" ON "Organization"("status");

INSERT INTO "Organization" (
  "id",
  "name",
  "status",
  "createdAt",
  "updatedAt"
) VALUES (
  'org-default',
  '默认组织',
  'enabled',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

ALTER TABLE "SystemUser" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "SystemUser" ADD COLUMN "organizationRole" TEXT NOT NULL DEFAULT 'member';

UPDATE "SystemUser"
SET
  "organizationId" = 'org-default',
  "organizationRole" = CASE
    WHEN "roles" && ARRAY['R_SUPER', 'R_ADMIN']::TEXT[] THEN 'admin'
    ELSE 'member'
  END
WHERE "organizationId" IS NULL;

ALTER TABLE "SystemUser" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SystemUser" ALTER COLUMN "organizationId" SET DEFAULT 'org-default';

CREATE INDEX "SystemUser_organizationId_idx" ON "SystemUser"("organizationId");
CREATE INDEX "SystemUser_organizationRole_idx" ON "SystemUser"("organizationRole");

ALTER TABLE "SystemUser"
ADD CONSTRAINT "SystemUser_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
