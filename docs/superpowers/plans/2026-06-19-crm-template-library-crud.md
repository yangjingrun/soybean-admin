# CRM 邮件模板库 CRUD 完成记录

## 目标

为 CRM 配置页补齐组织级邮件模板库 CRUD，使一个模板组可维护第 1-5 封邮件的主题、正文、线程方式和延迟天数，并可设置组织默认模板。

## 已落地范围

- 新增 `CrmEmailTemplateGroup` / `CrmEmailTemplateStep` Prisma 模型和迁移。
- 后端补齐模板组列表、创建、更新、归档、设置默认接口。
- `getTemplateDefaults` 优先返回组织默认模板，没有组织默认模板时继续返回内置全局模板。
- 首封草稿生成优先使用组织默认模板 step 1。
- 发送 worker 生成后续 follow-up 草稿时优先使用组织默认模板对应 step。
- 前端 CRM 配置页新增邮件模板库管理区，支持筛选、分页、新增、编辑、归档、设置默认。
- 抽离 `crm-email-template-renderer.ts` 统一模板变量替换和内置职位画像。

## 验证

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-worker.service.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts
pnpm --filter @soybean/server typecheck
pnpm typecheck
pnpm exec oxlint apps/server/src/modules/crm/crm-email-template-renderer.ts apps/server/src/modules/crm/crm-send-worker.service.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts apps/server/src/modules/crm/crm.service.ts apps/server/src/modules/crm/crm.controller.ts apps/server/src/modules/crm/store/prisma-crm.store.ts src/views/crm/settings/modules/EmailTemplateFormModal.vue src/views/crm/settings/modules/EmailTemplateManager.vue src/views/crm/settings/modules/EmailTemplateTable.vue src/views/crm/settings/modules/EmailTemplateToolbar.vue src/views/crm/settings/modules/useEmailTemplateTable.ts src/views/crm/settings/modules/shared.ts
pnpm exec eslint --max-warnings=0 .
git diff --check
```
