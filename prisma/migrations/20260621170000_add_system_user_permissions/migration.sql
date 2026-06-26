ALTER TABLE "SystemUser" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "SystemUser"
SET "permissions" = ARRAY[
  'crm:settings:assets:read',
  'crm:settings:assets:write',
  'crm:settings:rules:read',
  'crm:settings:rules:write',
  'crm:settings:safety:read',
  'crm:settings:safety:write'
]::TEXT[]
WHERE "roles" @> ARRAY['R_ADMIN']::TEXT[]
  AND NOT ("roles" @> ARRAY['R_SUPER']::TEXT[]);
