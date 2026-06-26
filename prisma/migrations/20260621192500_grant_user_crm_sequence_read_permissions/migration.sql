UPDATE "SystemRole"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY[
    'crm:settings:assets:read',
    'crm:settings:rules:read'
  ]::TEXT[]) AS permission
)
WHERE "roleCode" = 'R_USER'
  AND "builtIn" = true;
