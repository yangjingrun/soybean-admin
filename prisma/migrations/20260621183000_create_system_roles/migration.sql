CREATE TABLE "SystemRole" (
  "id" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  "roleCode" TEXT NOT NULL,
  "roleDesc" TEXT,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'enabled',
  "builtIn" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemRole_roleCode_key" ON "SystemRole"("roleCode");
CREATE INDEX "SystemRole_status_idx" ON "SystemRole"("status");
CREATE INDEX "SystemRole_builtIn_idx" ON "SystemRole"("builtIn");

INSERT INTO "SystemRole" (
  "id",
  "roleName",
  "roleCode",
  "roleDesc",
  "permissions",
  "status",
  "builtIn"
) VALUES
(
  'role-super',
  '超级管理员',
  'R_SUPER',
  '平台最高权限角色',
  ARRAY[
    'crm:settings:assets:read',
    'crm:settings:assets:write',
    'crm:settings:rules:read',
    'crm:settings:rules:write',
    'crm:settings:safety:read',
    'crm:settings:safety:write',
    'crm:settings:global:write',
    'crm:settings:ai-draft-queue:write',
    'crm:settings:operations:write'
  ]::TEXT[],
  'enabled',
  true
),
(
  'role-admin',
  '管理员',
  'R_ADMIN',
  '组织管理与常规配置角色',
  ARRAY[
    'crm:settings:assets:read',
    'crm:settings:assets:write',
    'crm:settings:rules:read',
    'crm:settings:rules:write',
    'crm:settings:safety:read',
    'crm:settings:safety:write'
  ]::TEXT[],
  'enabled',
  true
),
(
  'role-user',
  '普通用户',
  'R_USER',
  '默认业务成员角色',
  ARRAY[]::TEXT[],
  'enabled',
  true
);
