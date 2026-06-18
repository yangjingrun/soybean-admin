# 用户管理 CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PostgreSQL-backed user management with CRUD-style create/edit/enable/disable/reset-password, database-backed login, account lockout, and frontend management UI.

**Architecture:** Add `SystemUser` as the source of truth in PostgreSQL. Keep token storage as in-memory maps for this phase, but add user-level token revocation so disable/reset-password kicks users out immediately. Keep user management as a bounded backend module with DTOs, service, controller, and frontend page modules.

**Tech Stack:** NestJS, Prisma 7 generated client, PostgreSQL, Vue 3 `<script setup>`, Naive UI, Pinia auth store, Node `crypto.scrypt`.

---

### Task 1: Database And Password Foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260618190000_create_system_users/migration.sql`
- Create: `apps/server/src/modules/auth/password.ts`
- Modify generated Prisma client files via `pnpm exec prisma generate`

- [ ] Add `SystemUser` model with `String[] roles`, unique `userName`, profile fields, status, expiry, lockout, password hash/salt, login audit fields, timestamps, and indexes.
- [ ] Create migration SQL for `SystemUser` with four default users: `Super`, `Admin`, `User`, `Soybean`; hash default password `123456` using the new password helper values.
- [ ] Implement password helpers:
  - `hashPassword(password: string): Promise<{ hash: string; salt: string }>`
  - `verifyPassword(password: string, salt: string, hash: string): Promise<boolean>`
  - `generateTemporaryPassword(): string`
- [ ] Run `pnpm exec prisma generate`.
- [ ] Add node:test coverage for password hashing and temporary password shape.

### Task 2: AuthService Database Login And Token Revocation

**Files:**
- Modify: `apps/server/src/modules/auth/auth.service.ts`
- Modify: `apps/server/src/modules/auth/auth.controller.ts`
- Modify: `apps/server/src/modules/auth/auth.module.ts`
- Modify: `apps/server/src/modules/auth/auth.types.ts`
- Modify: `apps/server/src/modules/auth/auth.controller.spec.ts`
- Add/modify auth service tests as needed

- [ ] Inject `PrismaService` into `AuthService`.
- [ ] Replace demo-user credential lookup with `SystemUser` lookup by case-insensitive `userName`.
- [ ] Enforce login checks: enabled status, not expired, not locked, password verification.
- [ ] Track failed login count and lock for 15 minutes on the fifth bad password.
- [ ] On successful login, clear failed count and lock, update `lastLoginAt`.
- [ ] Implement `revokeUserTokens(userId: string)` and make `logout` revoke refresh token for the current access token too.
- [ ] Keep `getUserByAccessToken` synchronous for current controller compatibility by storing fresh `UserInfo` snapshots in access-token map; revoke tokens on user changes.
- [ ] Make `refresh` use refresh-token map and reject revoked tokens.
- [ ] Update auth controller logging without logging password/token/hash/salt.

### Task 3: System User Backend CRUD

**Files:**
- Modify: `apps/server/src/modules/system-user/system-user.types.ts`
- Modify: `apps/server/src/modules/system-user/dto/system-user-query.dto.ts`
- Create DTO files under `apps/server/src/modules/system-user/dto`
- Create: `apps/server/src/modules/system-user/system-user.service.ts`
- Modify: `apps/server/src/modules/system-user/system-user.controller.ts`
- Modify: `apps/server/src/modules/system-user/system-user.module.ts`
- Modify: `apps/server/src/modules/system-user/system-user.controller.spec.ts`
- Add service tests as needed

- [ ] Add fixed role/status/expiration types and DTOs for list/create/update/status/reset-password.
- [ ] Move user listing out of `AuthService.listUsers` into `SystemUserService`.
- [ ] Implement list filters: pagination, keyword, role, status, expiration status.
- [ ] Implement create user: unique userName, at least one role, generated temporary password returned once.
- [ ] Implement update user: profile fields, userName uniqueness, role guard preventing current super admin from losing `R_SUPER`, global guard preserving at least one enabled non-expired `R_SUPER`.
- [ ] Implement enable/disable: reject disabling self, preserve last active super admin, revoke tokens on disable.
- [ ] Implement reset password: generated temporary password returned once, clear lockout, revoke tokens.
- [ ] Record system logs for create/update/enable/disable/reset-password without secrets.

### Task 4: Frontend API, Types, And Helpers

**Files:**
- Modify: `src/typings/api/system-user.d.ts`
- Modify: `src/service/api/system-user.ts`
- Modify: `src/views/manage/user/modules/shared.ts`
- Modify: `src/views/manage/user/modules/shared.spec.ts`

- [ ] Expand system-user API types for list rows, filters, create/update payloads, status payload, reset password response.
- [ ] Add service API functions for create, update, enable/disable, reset password.
- [ ] Expand helper maps and query builder for role/status/expiration filters.
- [ ] Add helper tests for query params and status labels.

### Task 5: Frontend User Management UI

**Files:**
- Modify: `src/views/manage/user/index.vue`
- Modify: `src/views/manage/user/modules/UserSearch.vue`
- Create: `src/views/manage/user/modules/UserOperateDrawer.vue`
- Create: `src/views/manage/user/modules/TemporaryPasswordModal.vue`

- [ ] Add search fields: keyword, role, status, expiration status.
- [ ] Add table columns: username, nickname, roles, status, expiration, locked state, company, last login, operation.
- [ ] Add create/edit drawer with profile fields, roles, expireAt, remark; no password field.
- [ ] Add enable/disable operation with confirmation.
- [ ] Add reset password operation with confirmation.
- [ ] Show temporary password modal after create/reset; clear password on close.

### Task 6: Integration Verification

**Files:**
- Update tests only if directly required by changed contracts.

- [ ] Run backend system-user/auth focused tests.
- [ ] Run frontend helper tests.
- [ ] Run `pnpm typecheck`.
- [ ] If service typecheck fails due unrelated dirty ai-leads work, report exact unrelated errors.
- [ ] Do not run `npm run build`.
- [ ] Commit only user-management related files; do not include unrelated ai-leads or prior docs changes.

---

## Self-Review

- Spec coverage: database users, login, CRUD, disable, reset password, lockout, frontend UI, logging, and package non-goal are covered.
- Placeholder scan: no placeholders.
- Type consistency: uses `SystemUser`, `enabled | disabled`, `expired | active`, `temporaryPassword`, and fixed roles consistently.
