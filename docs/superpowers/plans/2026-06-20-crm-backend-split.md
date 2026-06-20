# CRM Backend Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current oversized CRM backend into focused NestJS services, repositories, controllers, and eventually modules without changing frontend API paths, database schema, or business behavior.

**Architecture:** Use an incremental compatibility-facade approach. Keep `CrmService`, `CrmController`, `CRM_STORE`, and `PrismaCrmStore` working at first, then introduce small domain services and repository ports that delegate to the legacy store; only after behavior is covered by focused tests, split the Prisma store and controllers.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, BullMQ, Naive Admin frontend contracts, existing `pnpm exec tsx --test` test runner.

---

## Non-Negotiable Constraints

- Do not change existing frontend routes or request paths in the first refactor pass.
- Do not change database schema in this plan unless a later task explicitly proves it is required.
- Do not run `npm run build`; use focused tests and typecheck only.
- Preserve member-private CRM isolation: member data is scoped by `organizationId + ownerUserId`.
- Preserve owner-only write rules for mailbox binding, draft editing, draft approval, sending, and reply body writes.
- Preserve sequence safety guards: `runVersion`, `bullJobId`, status checks, mailbox active checks, blacklist checks, and quota claim must remain transaction-protected.
- Preserve Gmail and inbox idempotency: inbound messages must stay idempotent by provider message id.
- Keep `CrmService` as a compatibility facade until all controller paths are delegated and covered.

## Final Target Structure

```text
apps/server/src/modules/crm/
  crm.module.ts
  crm.tokens.ts
  crm.service.ts
  controllers/
    crm-account.controller.ts
    crm-settings.controller.ts
    crm-mailbox.controller.ts
    crm-sequence.controller.ts
    crm-inbox.controller.ts
    crm-dashboard.controller.ts
  shared/
    crm-context.ts
    crm-scope.ts
    crm-permission.ts
    crm-errors.ts
    crm-logger.service.ts
    crm-result-mappers.ts
  accounts/
    crm-account.service.ts
    crm-account.repository.ts
    prisma-crm-account.repository.ts
    legacy-crm-account.repository.ts
  settings/
    crm-settings.service.ts
    crm-settings.repository.ts
    prisma-crm-settings.repository.ts
    legacy-crm-settings.repository.ts
  suppression/
    crm-suppression.service.ts
    crm-suppression.repository.ts
    prisma-crm-suppression.repository.ts
    legacy-crm-suppression.repository.ts
  mailbox/
    crm-mailbox.service.ts
    crm-mailbox.repository.ts
    prisma-crm-mailbox.repository.ts
    legacy-crm-mailbox.repository.ts
    gmail/
      crm-gmail-oauth-flow.ts
      crm-gmail-provider.factory.ts
      crm-gmail-watch.service.ts
      crm-gmail-webhook.service.ts
  sequence/
    crm-sequence.service.ts
    crm-draft.service.ts
    crm-sequence-send.service.ts
    crm-sequence.repository.ts
    prisma-crm-sequence.repository.ts
    legacy-crm-sequence.repository.ts
  inbox/
    crm-inbox.service.ts
    crm-inbox.repository.ts
    prisma-crm-inbox.repository.ts
    legacy-crm-inbox.repository.ts
  dashboard/
    crm-dashboard.service.ts
    crm-dashboard.repository.ts
    prisma-crm-dashboard.repository.ts
    legacy-crm-dashboard.repository.ts
  store/
    prisma-crm.mappers.ts
    prisma-crm.includes.ts
    prisma-crm.store.ts
```

## Domain Boundary Map

| Domain | Owns | Must Not Own |
| --- | --- | --- |
| `accounts` | account import, contact import, notes, archive/restore, email verification, archived fingerprints, account timeline | sending, Gmail OAuth, inbox reply drafting |
| `settings` | global config, organization config, send preference, product lines, persona profiles, email templates, sequence policies, template defaults, AI draft queue config | account records, actual message sending |
| `suppression` | blacklist list/remove/upsert/query, organization-level unsubscribe checks | inbox message creation, sequence state transitions |
| `mailbox` | mailbox bind/list/pause/resume, Gmail OAuth, Gmail watch, mailbox sync mode, mailbox authorization expiration | message body editing, sequence approval |
| `sequence` | review items, enrollments, message drafts, draft versions, AI draft tasks, send start/stop/reconcile, worker claim/complete/fail | Gmail OAuth callback, inbox thread UI status |
| `inbox` | inbox threads, inbound message ingest, reply drafts, reply send, unsubscribe confirmation, customer-reply notifications | product/persona/template CRUD |
| `dashboard` | workbench overview, strategy stats, read-only aggregates | writes and side effects |

## Method Migration Map From `CrmService`

| Current Method Group | New Owner |
| --- | --- |
| `importAccountFromLead`, `listAccounts`, `getAccountDetail`, `updateAccountStatus`, `addAccountNote`, `archiveAccount`, `restoreAccount`, `verifyContactEmail` | `CrmAccountService` |
| `getGlobalConfig`, `saveGlobalConfig`, `getOrganizationConfig`, `saveOrganizationConfig`, `getSendPreference`, `saveSendPreference`, product line/persona/template/sequence-policy methods, `getTemplateDefaults`, AI draft queue config methods | `CrmSettingsService` |
| `listBlacklistEntries`, `removeBlacklistEntry`, runtime blacklist checks | `CrmSuppressionService` |
| `mockAuthorizeMailbox`, `createGmailOAuthAuthorizationUrl`, `completeGmailOAuthAuthorization`, `listMailboxes`, `pauseMailbox`, `resumeMailbox` | `CrmMailboxService` |
| `listSequenceReviewItems`, `getSequenceReviewItem`, `createSequenceReviewItem`, draft edit/regenerate/approve/version/restore, next draft generation, batch operations, send start/stop/reconcile | `CrmSequenceService`, `CrmDraftService`, `CrmSequenceSendService` |
| `createAiDraftTask`, `getCurrentAiDraftTask`, `listAiDraftTasks`, `retryFailedAiDraftTask`, `cancelAiDraftTask`, `markAiDraftTaskRead` | `CrmSequenceService` first, optionally `CrmAiDraftTaskService` later |
| `listInboxThreads`, `getInboxThread`, `polishInboxReplyDraft`, `saveInboxReplyDraft`, `updateInboxThreadStatus`, `replyInboxThread`, `mockCustomerReply`, `confirmInboxMessageUnsubscribe` | `CrmInboxService` |
| `listStrategyStats`, `getWorkbenchOverview` | `CrmDashboardService` |

## Repository Split Map From `CrmStore`

| Current `CrmStore` Methods | New Repository |
| --- | --- |
| account/contact/archive/timeline/email verification cache methods | `CrmAccountRepository` |
| global/org/send config, product line, persona, email template, sequence policy, AI draft queue config methods | `CrmSettingsRepository` |
| blacklist methods and batch blacklist lookup | `CrmSuppressionRepository` |
| mailbox methods, authorization expiry, history id advance, watch renewal list | `CrmMailboxRepository` |
| enrollment/message/draft version/review/send claim/send completion/fail/stop methods | `CrmSequenceRepository` |
| inbox thread/message/reply/unsubscribe/customer-reply ingest methods | `CrmInboxRepository` |
| strategy stats, workbench overview, send state counts used only for dashboards | `CrmDashboardRepository` |

---

## Phase 0: Baseline And Safety Net

**Files:**
- Read only: `apps/server/src/modules/crm/crm.service.ts`
- Read only: `apps/server/src/modules/crm/crm.controller.ts`
- Read only: `apps/server/src/modules/crm/crm.types.ts`
- Read only: `apps/server/src/modules/crm/store/prisma-crm.store.ts`

- [ ] **Step 1: Capture current git state**

```bash
git status --short
```

Expected: know which files are already dirty before refactor starts. Do not clean unrelated generated Prisma files.

- [ ] **Step 2: Run CRM baseline tests before moving code**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts
```

Expected: current pass/fail baseline is known before refactor. If tests already fail, record exact failing tests and do not mix fixes into the structural split.

- [ ] **Step 3: Generate method inventory**

```bash
rg -n "^  async |^  private |@(Get|Post|Patch|Delete|Put)\\(" apps/server/src/modules/crm
```

Expected: method and route inventory matches the migration maps in this document.

- [ ] **Step 4: Commit only if there is an intentional baseline doc change**

```bash
git diff -- docs/superpowers/plans/2026-06-20-crm-backend-split.md
```

Expected: no business code has changed in Phase 0.

---

## Phase 1: Shared Context, Scope, Error, And Log Helpers

**Files:**
- Create: `apps/server/src/modules/crm/shared/crm-context.ts`
- Create: `apps/server/src/modules/crm/shared/crm-scope.ts`
- Create: `apps/server/src/modules/crm/shared/crm-errors.ts`
- Create: `apps/server/src/modules/crm/shared/crm-logger.service.ts`
- Create: `apps/server/src/modules/crm/shared/crm-scope.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`
- Modify: `apps/server/src/modules/crm/crm.service.ts`

- [ ] **Step 1: Add explicit context and scope types**

```ts
// apps/server/src/modules/crm/shared/crm-context.ts
import type { OrganizationRole } from '@sa/shared';

export interface CrmUserContext {
  userId: string;
  userName?: string | null;
  roles: string[];
  organizationId: string;
  organizationRole: OrganizationRole;
}
```

```ts
// apps/server/src/modules/crm/shared/crm-scope.ts
import { ForbiddenException } from '@nestjs/common';
import { isOrganizationAdmin, isSuper } from '../../../shared/permission-policy';
import type { CrmUserContext } from './crm-context';

export interface CrmReadScope {
  organizationId: string;
  ownerUserId?: string;
}

export interface CrmOwnerWriteScope {
  organizationId: string;
  ownerUserId: string;
}

export interface CrmOrganizationAdminScope {
  organizationId: string;
}

/** Returns org-wide scope for admins and owner scope for ordinary members. */
export function createCrmReadScope(context: CrmUserContext): CrmReadScope {
  return isSuper(context) || isOrganizationAdmin(context)
    ? { organizationId: context.organizationId }
    : { organizationId: context.organizationId, ownerUserId: context.userId };
}

/** Any operation that edits private CRM data must be owner-only. */
export function createCrmOwnerWriteScope(context: CrmUserContext): CrmOwnerWriteScope {
  return { organizationId: context.organizationId, ownerUserId: context.userId };
}

/** Organization-level configuration writes require admin privileges. */
export function requireCrmOrganizationAdminScope(context: CrmUserContext): CrmOrganizationAdminScope {
  if (!isSuper(context) && !isOrganizationAdmin(context)) {
    throw new ForbiddenException('仅组织管理员可操作 CRM 组织配置');
  }
  return { organizationId: context.organizationId };
}
```

- [ ] **Step 2: Add scope unit tests**

```ts
// apps/server/src/modules/crm/shared/crm-scope.spec.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCrmOwnerWriteScope,
  createCrmReadScope,
  requireCrmOrganizationAdminScope
} from './crm-scope';

test('createCrmReadScope keeps ordinary members owner-scoped', () => {
  const scope = createCrmReadScope({
    userId: 'user-1',
    userName: 'Member',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member'
  });

  assert.deepEqual(scope, { organizationId: 'org-1', ownerUserId: 'user-1' });
});

test('createCrmReadScope allows organization admin to read organization scope', () => {
  const scope = createCrmReadScope({
    userId: 'admin-1',
    userName: 'Admin',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'admin'
  });

  assert.deepEqual(scope, { organizationId: 'org-1' });
});

test('createCrmOwnerWriteScope is always owner-only', () => {
  const scope = createCrmOwnerWriteScope({
    userId: 'admin-1',
    userName: 'Admin',
    roles: ['R_SUPER'],
    organizationId: 'org-1',
    organizationRole: 'admin'
  });

  assert.deepEqual(scope, { organizationId: 'org-1', ownerUserId: 'admin-1' });
});

test('requireCrmOrganizationAdminScope rejects ordinary members', () => {
  assert.throws(
    () =>
      requireCrmOrganizationAdminScope({
        userId: 'user-1',
        userName: 'Member',
        roles: ['R_USER'],
        organizationId: 'org-1',
        organizationRole: 'member'
      }),
    /组织管理员/
  );
});
```

- [ ] **Step 3: Replace only the old `toOwnerScope` implementation**

Modify `apps/server/src/modules/crm/crm.service.ts` so existing methods still work but call `createCrmReadScope(context)` and `createCrmOwnerWriteScope(context)` through small wrapper methods. Do not move business methods yet.

- [ ] **Step 4: Register shared logger**

Create `CrmLoggerService` as a thin wrapper around `SystemLogService`; move only `recordCrmLog(...)` behavior first. Keep action names and metadata unchanged.

- [ ] **Step 5: Run focused validation**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/shared/crm-scope.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts
```

Expected: scope helper tests pass, CRM service behavior remains unchanged.

---

## Phase 2: Add Repository Ports With Legacy Adapters

**Files:**
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Create: `apps/server/src/modules/crm/accounts/crm-account.repository.ts`
- Create: `apps/server/src/modules/crm/accounts/legacy-crm-account.repository.ts`
- Create: `apps/server/src/modules/crm/settings/crm-settings.repository.ts`
- Create: `apps/server/src/modules/crm/settings/legacy-crm-settings.repository.ts`
- Create: `apps/server/src/modules/crm/suppression/crm-suppression.repository.ts`
- Create: `apps/server/src/modules/crm/suppression/legacy-crm-suppression.repository.ts`
- Create: `apps/server/src/modules/crm/mailbox/crm-mailbox.repository.ts`
- Create: `apps/server/src/modules/crm/mailbox/legacy-crm-mailbox.repository.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-sequence.repository.ts`
- Create: `apps/server/src/modules/crm/sequence/legacy-crm-sequence.repository.ts`
- Create: `apps/server/src/modules/crm/inbox/crm-inbox.repository.ts`
- Create: `apps/server/src/modules/crm/inbox/legacy-crm-inbox.repository.ts`
- Create: `apps/server/src/modules/crm/dashboard/crm-dashboard.repository.ts`
- Create: `apps/server/src/modules/crm/dashboard/legacy-crm-dashboard.repository.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Add small repository tokens**

```ts
// apps/server/src/modules/crm/crm.tokens.ts
export const CRM_ACCOUNT_REPOSITORY = Symbol('CRM_ACCOUNT_REPOSITORY');
export const CRM_SETTINGS_REPOSITORY = Symbol('CRM_SETTINGS_REPOSITORY');
export const CRM_SUPPRESSION_REPOSITORY = Symbol('CRM_SUPPRESSION_REPOSITORY');
export const CRM_MAILBOX_REPOSITORY = Symbol('CRM_MAILBOX_REPOSITORY');
export const CRM_SEQUENCE_REPOSITORY = Symbol('CRM_SEQUENCE_REPOSITORY');
export const CRM_INBOX_REPOSITORY = Symbol('CRM_INBOX_REPOSITORY');
export const CRM_DASHBOARD_REPOSITORY = Symbol('CRM_DASHBOARD_REPOSITORY');
```

- [ ] **Step 2: Define minimal repository interfaces by copying exact method signatures from `CrmStore`**

Example for accounts:

```ts
// apps/server/src/modules/crm/accounts/crm-account.repository.ts
import type {
  CrmAccountCreateInput,
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmArchivedFingerprintLookupInput,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintUpsertInput,
  CrmContactCreateInput,
  CrmContactRecord,
  CrmContactUpdateInput,
  CrmEmailStatus,
  CrmEmailVerificationCacheRecord,
  CrmEmailVerificationCacheUpsertInput,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from '../crm.types';

export interface CrmAccountRepository {
  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string): Promise<CrmAccountRecord | null>;
  createAccount(input: CrmAccountCreateInput): Promise<CrmAccountRecord>;
  updateAccount(id: string, input: CrmAccountUpdateInput): Promise<CrmAccountRecord | null>;
  findContactByEmailHash(organizationId: string, ownerUserId: string, emailHash: string): Promise<CrmContactRecord | null>;
  createContact(input: CrmContactCreateInput): Promise<CrmContactRecord>;
  updateContact(id: string, input: CrmContactUpdateInput): Promise<CrmContactRecord | null>;
  findContactById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmContactRecord | null>;
  updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus): Promise<CrmContactRecord | null>;
  findEmailVerificationCache(args: { emailHash: string }): Promise<CrmEmailVerificationCacheRecord | null>;
  upsertEmailVerificationCache(input: CrmEmailVerificationCacheUpsertInput): Promise<CrmEmailVerificationCacheRecord>;
  findArchivedFingerprints(input: CrmArchivedFingerprintLookupInput): Promise<CrmArchivedFingerprintRecord[]>;
  upsertArchivedFingerprint(input: CrmArchivedFingerprintUpsertInput): Promise<CrmArchivedFingerprintRecord>;
  listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmAccountStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmAccountRecord[]; total: number }>;
  getAccountDetail(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAccountDetailRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
```

- [ ] **Step 3: Implement legacy adapters as pure delegators**

```ts
// apps/server/src/modules/crm/accounts/legacy-crm-account.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmAccountRepository } from './crm-account.repository';

@Injectable()
export class LegacyCrmAccountRepository implements CrmAccountRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  findAccountByDomain(...args: Parameters<CrmStore['findAccountByDomain']>) {
    return this.store.findAccountByDomain(...args);
  }

  createAccount(...args: Parameters<CrmStore['createAccount']>) {
    return this.store.createAccount(...args);
  }

  // Repeat for every method listed in CrmAccountRepository.
}
```

Implementation note: write all delegator methods explicitly; do not use `as unknown as` or broad proxy magic.

- [ ] **Step 4: Register all legacy adapters in `CrmModule`**

```ts
{
  provide: CRM_ACCOUNT_REPOSITORY,
  useClass: LegacyCrmAccountRepository
}
```

Repeat for all repository tokens.

- [ ] **Step 5: Run typecheck for interface drift**

```bash
pnpm --filter @soybean/server typecheck
```

Expected: any missing adapter method fails at compile time before service extraction starts.

---

## Phase 3: Extract Settings Domain First

**Files:**
- Create: `apps/server/src/modules/crm/settings/crm-settings.service.ts`
- Create: `apps/server/src/modules/crm/settings/crm-settings.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Move low-risk configuration methods into `CrmSettingsService`**

Move these public methods from `CrmService`:

```text
getGlobalConfig
saveGlobalConfig
getSendPreference
saveSendPreference
getOrganizationConfig
saveOrganizationConfig
listProductLines
createProductLine
updateProductLine
listProductLineAiPromptVersions
restoreProductLineAiPromptVersion
archiveProductLine
listPersonaProfiles
createPersonaProfile
updatePersonaProfile
archivePersonaProfile
setDefaultPersonaProfile
listEmailTemplateGroups
createEmailTemplateGroup
updateEmailTemplateGroup
archiveEmailTemplateGroup
setDefaultEmailTemplateGroup
getTemplateDefaults
listSequencePolicies
createSequencePolicy
updateSequencePolicy
archiveSequencePolicy
setDefaultSequencePolicy
getAiDraftQueueConfig
saveAiDraftQueueConfig
```

Move these private helpers with them:

```text
requireOrganizationConfigManager
requireScopedProductLine
requireActiveProductLine
requireScopedPersonaProfile
resolvePersonaProfileMatch
requireScopedEmailTemplateGroup
requireScopedSequencePolicy
requireActiveSequencePolicy
assertSameCompanySequencePolicy
assertProductLineNameAvailable
createProductLineAiPromptVersionIfPresent
createProductLineAiPromptVersionIfChanged
assertCanWriteProductLineAiConfig
assertEmailTemplateNameAvailable
assertPersonaProfileNameAvailable
runProductLineWrite
runEmailTemplateWrite
runPersonaProfileWrite
runSequencePolicyWrite
recordProductLineLog
recordEmailTemplateLog
recordPersonaProfileLog
recordSequencePolicyLog
```

- [ ] **Step 2: Keep `CrmService` as facade**

```ts
// apps/server/src/modules/crm/crm.service.ts
async listProductLines(query: ProductLineListQuery, context: CrmUserContext) {
  return this.settings.listProductLines(query, context);
}
```

Repeat for all moved settings methods so controller behavior remains unchanged.

- [ ] **Step 3: Add focused settings tests**

Move existing relevant assertions from `crm.service.spec.ts` into `crm-settings.service.spec.ts`. Keep a smaller facade test in `crm.service.spec.ts` that verifies `CrmService` delegates to `CrmSettingsService` for one representative method.

- [ ] **Step 4: Validate settings extraction**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/settings/crm-settings.service.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts
```

Expected: no route or response shape changes.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM 配置服务"
```

---

## Phase 4: Extract Accounts And Suppression

**Files:**
- Create: `apps/server/src/modules/crm/accounts/crm-account.service.ts`
- Create: `apps/server/src/modules/crm/accounts/crm-account.service.spec.ts`
- Create: `apps/server/src/modules/crm/suppression/crm-suppression.service.ts`
- Create: `apps/server/src/modules/crm/suppression/crm-suppression.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Move account methods**

Move these public methods:

```text
importAccountFromLead
listAccounts
getAccountDetail
updateAccountStatus
addAccountNote
archiveAccount
restoreAccount
verifyContactEmail
```

Move these helpers:

```text
importContactIfPresent
applyContactEmailVerification
applyImportedContactAccountStatus
changeAccountStatus
verifyEmailWithCache
findArchivedImportMatches
createArchivedMatchTimelineIfNeeded
upsertArchivedFingerprints
verifyEmailAddress
requireScopedAccountDetail
requireScopedAccountAndContact
```

- [ ] **Step 2: Move suppression methods**

Move these public methods:

```text
listBlacklistEntries
removeBlacklistEntry
```

Move or expose these checks through `CrmSuppressionService`:

```text
assertContactNotBlacklisted
loadBlacklistedContactEmailHashes
```

- [ ] **Step 3: Keep facade delegation**

All current controller calls remain on `CrmService`; each moved method delegates to `CrmAccountService` or `CrmSuppressionService`.

- [ ] **Step 4: Preserve member isolation tests**

In `crm-account.service.spec.ts`, keep tests for:

```text
same organization different members do not reuse each other's accounts
archived fingerprint match writes timeline but does not reuse another owner's record
account detail uses organization-wide read only for admins
ordinary member account detail remains owner-scoped
```

In `crm-suppression.service.spec.ts`, keep tests for:

```text
blacklist entries are organization-scoped
remove blacklist requires organization/admin write permission if current behavior requires it
runtime checks return only normalized email-hash matches
```

- [ ] **Step 5: Validate accounts and suppression**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/accounts/crm-account.service.spec.ts \
  apps/server/src/modules/crm/suppression/crm-suppression.service.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

Expected: account import, member isolation, archive fingerprint, and blacklist behavior stay identical.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM 线索和黑名单服务"
```

---

## Phase 5: Extract Mailbox And Gmail Boundary

**Files:**
- Create: `apps/server/src/modules/crm/mailbox/crm-mailbox.service.ts`
- Create: `apps/server/src/modules/crm/mailbox/crm-mailbox.service.spec.ts`
- Move later: `apps/server/src/modules/crm/crm-gmail-*.ts` into `apps/server/src/modules/crm/mailbox/gmail/`
- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Move mailbox orchestration methods**

Move these public methods:

```text
mockAuthorizeMailbox
createGmailOAuthAuthorizationUrl
completeGmailOAuthAuthorization
listMailboxes
pauseMailbox
resumeMailbox
```

Move these helpers:

```text
requireScopedMailbox
requireOwnedActiveMailbox
changeMailboxStatus
requireGmailOAuthFlow
renewWatchAfterOAuthAuthorization
recordMailboxLog
resolveMailboxSyncMode
```

- [ ] **Step 2: Consolidate Gmail provider factory usage**

Replace repeated calls to `createCrmGmailIntegrationProviders(...)` in `crm.module.ts` with one provider:

```ts
export const CRM_GMAIL_INTEGRATION = Symbol('CRM_GMAIL_INTEGRATION');

{
  provide: CRM_GMAIL_INTEGRATION,
  useFactory: (appConfigService: AppConfigService) =>
    createCrmGmailIntegrationProviders(appConfigService.config.crmGmailIntegrationEnv),
  inject: [AppConfigService]
}
```

Then expose `CRM_GMAIL_HISTORY_GATEWAY`, `CRM_GMAIL_WATCH_GATEWAY`, `CRM_GMAIL_OAUTH_FLOW`, and `CRM_EMAIL_SEND_GATEWAY` from that one integration object.

- [ ] **Step 3: Move direct `process.env` reads behind `AppConfigService`**

Move mailbox/Gmail runtime config reads out of services and into config loader fields. Preserve current default values exactly.

- [ ] **Step 4: Validate Gmail-related behavior without requiring real Gmail**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/mailbox/crm-mailbox.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-provider.factory.spec.ts \
  apps/server/src/modules/crm/crm-gmail-oauth-flow.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch.gateway.spec.ts
```

Expected: OAuth URL/callback, 403 classification, mailbox ownership, and watch renewal behavior stay unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/crm apps/server/src/modules/app-config
git commit --no-verify -m "refactor: 拆分 CRM 邮箱和 Gmail 边界"
```

---

## Phase 6: Extract Sequence, Draft, AI Draft Task, And Send Boundary

**Files:**
- Create: `apps/server/src/modules/crm/sequence/crm-sequence.service.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-draft.service.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-sequence-send.service.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-sequence.service.spec.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-draft.service.spec.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-sequence-send.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Extract read and create sequence review flows**

Move:

```text
createSequenceReviewItem
listSequenceReviewItems
getSequenceReviewItem
batchGenerateNextDrafts
generateNextDraft
generateNextDraftFromReviewItem
listStrategyStats stays dashboard, not sequence
```

Keep these checks in sequence service:

```text
requireScopedSequenceReviewItem
requireOwnedSequenceReviewItem
assertSameCompanySequencePolicy
assertContactNotBlacklisted via CrmSuppressionService
requireOwnedActiveMailbox via CrmMailboxService
```

- [ ] **Step 2: Extract draft editing and approval**

Move:

```text
previewAiDraft
updateMessageDraft
regenerateMessageAiDraft
listMessageDraftVersions
restoreMessageDraftVersion
approveMessageDraft
batchApproveMessageDrafts
approveFollowUpMessageDraft
```

Owner-only rule: every write path must use `createCrmOwnerWriteScope(context)`.

- [ ] **Step 3: Extract AI draft task orchestration**

Move:

```text
createAiDraftTask
enqueueAiDraftTaskIfPossible
completeSkippedAiDraftTask
getCurrentAiDraftTask
listAiDraftTasks
getAiDraftTaskDetail
retryFailedAiDraftTask
cancelAiDraftTask
markAiDraftTaskRead
requireScopedAiDraftTask
requireOwnedAiDraftTask
toAiDraftTaskDetail
createSkippedAiDraftTaskItem
getAiDraftTaskItemSkipMessage
```

Keep existing task state machine and notification behavior unchanged.

- [ ] **Step 4: Extract send start, stop, reconcile**

Move:

```text
startFirstMessageSend
stopSequenceEnrollment
batchStopSequenceEnrollments
reconcileSendQueue
enqueueFirstMessage
assertOwnerSendConcurrencyAvailable
```

Do not move `CrmSendWorkerService`, `CrmSendSchedulerService`, and queue services yet; only change their dependencies after `CrmSequenceSendService` is stable.

- [ ] **Step 5: Preserve transaction-critical repository methods**

Keep these methods transaction-backed in `CrmSequenceRepository`:

```text
createSequenceDraftBundle
createFollowUpDraftBundle
approveMessageDraft
startFirstMessageSend
claimFirstMessageSendDelivery
stopSequenceEnrollment
completeFirstMessageSend
failFirstMessageSend
```

Do not split one transaction into multiple service calls.

- [ ] **Step 6: Validate high-risk sequence behavior**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/sequence/crm-sequence.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-draft.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-sequence-send.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

Expected coverage:

```text
admin cannot approve another user's draft
approved draft cannot be edited back to pending
start send is owner-only
old runVersion job is skipped
mailbox paused before send does not write half-state
blacklisted contact is blocked before quota claim
quota is claimed once in worker path
stop sequence bumps runVersion and skips queued message
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM 序列和发送服务"
```

---

## Phase 7: Extract Inbox And Reply Boundary

**Files:**
- Create: `apps/server/src/modules/crm/inbox/crm-inbox.service.ts`
- Create: `apps/server/src/modules/crm/inbox/crm-inbox.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Move inbox public methods**

Move:

```text
listInboxThreads
getInboxThread
polishInboxReplyDraft
saveInboxReplyDraft
updateInboxThreadStatus
replyInboxThread
mockCustomerReply
confirmInboxMessageUnsubscribe
```

Move helpers:

```text
requireOwnedInboxThread
requireOwnedInboxThreadDetail
saveOwnedInboxReplyDraft
resolveInboxReplyDraftProductLine
buildInboxReplyDraftPromptInput
notifyCustomerReply
recordSuperAdminInboxBodyAudit
```

- [ ] **Step 2: Keep Gmail history worker using the inbox service through a narrow port**

Create a small command port if needed:

```ts
export interface CrmCustomerReplyIngestPort {
  ingestCustomerReply(input: CrmCustomerReplyIngestInput): Promise<CrmCustomerReplyIngestRecord | null>;
}
```

`CrmGmailHistorySyncWorkerService` should depend on this port rather than the full `CrmService`.

- [ ] **Step 3: Preserve inbox idempotency**

Repository method `ingestCustomerReply` remains one transaction. It must continue to:

```text
dedupe by providerMessageId
return duplicate result without new notification
upsert organization-level blacklist for unsubscribe
stop related active sequence state in the same transaction if current behavior does so
write timeline event only for new inbound message
```

- [ ] **Step 4: Validate inbox behavior**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/inbox/crm-inbox.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

Expected: duplicate Gmail message does not create duplicate inbox/timeline/notification, unsubscribe still blacklists organization email hash, reply body permissions remain owner-only.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM 收件箱服务"
```

---

## Phase 8: Extract Dashboard Read Model

**Files:**
- Create: `apps/server/src/modules/crm/dashboard/crm-dashboard.service.ts`
- Create: `apps/server/src/modules/crm/dashboard/crm-dashboard.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Move read-only aggregate methods**

Move:

```text
listStrategyStats
getWorkbenchOverview
```

- [ ] **Step 2: Keep dashboard repository read-only**

`CrmDashboardRepository` should not expose mutation methods.

- [ ] **Step 3: Validate dashboard**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/dashboard/crm-dashboard.service.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts
```

Expected: workbench and strategy stats response shape unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM 工作台读模型"
```

---

## Phase 9: Split Prisma Store Into Domain Repositories

**Files:**
- Create: `apps/server/src/modules/crm/store/prisma-crm.mappers.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm.includes.ts`
- Create: `apps/server/src/modules/crm/accounts/prisma-crm-account.repository.ts`
- Create: `apps/server/src/modules/crm/settings/prisma-crm-settings.repository.ts`
- Create: `apps/server/src/modules/crm/suppression/prisma-crm-suppression.repository.ts`
- Create: `apps/server/src/modules/crm/mailbox/prisma-crm-mailbox.repository.ts`
- Create: `apps/server/src/modules/crm/sequence/prisma-crm-sequence.repository.ts`
- Create: `apps/server/src/modules/crm/inbox/prisma-crm-inbox.repository.ts`
- Create: `apps/server/src/modules/crm/dashboard/prisma-crm-dashboard.repository.ts`
- Modify: `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Extract pure Prisma mapper/include helpers first**

Move shared `toCrm*Record(...)`, include objects, enum mappers, and normalized projection helpers from `prisma-crm.store.ts` into:

```text
store/prisma-crm.mappers.ts
store/prisma-crm.includes.ts
```

Do not change method behavior.

- [ ] **Step 2: Create Prisma repositories one domain at a time**

Order:

```text
settings
dashboard
suppression
accounts
mailbox
sequence
inbox
```

Use this order because settings/dashboard are lowest risk, while sequence/inbox have transaction-heavy paths.

- [ ] **Step 3: Replace legacy adapter bindings one at a time**

Example:

```ts
{
  provide: CRM_SETTINGS_REPOSITORY,
  useClass: PrismaCrmSettingsRepository
}
```

Keep `CRM_STORE -> PrismaCrmStore` registered until the last legacy adapter is gone.

- [ ] **Step 4: Preserve transaction methods inside domain repositories**

These transaction methods must move as complete blocks:

```text
PrismaCrmSequenceRepository.createSequenceDraftBundle
PrismaCrmSequenceRepository.createFollowUpDraftBundle
PrismaCrmSequenceRepository.approveMessageDraft
PrismaCrmSequenceRepository.startFirstMessageSend
PrismaCrmSequenceRepository.claimFirstMessageSendDelivery
PrismaCrmSequenceRepository.stopSequenceEnrollment
PrismaCrmSequenceRepository.completeFirstMessageSend
PrismaCrmSequenceRepository.failFirstMessageSend
PrismaCrmInboxRepository.ingestCustomerReply
```

- [ ] **Step 5: Retire `CrmStore` only after no provider uses it**

```bash
rg -n "CRM_STORE|CrmStore|PrismaCrmStore" apps/server/src/modules/crm
```

Expected before deletion: references remain only in tests or the old store file. Delete legacy adapters and old store only when this command proves there are no production users.

- [ ] **Step 6: Validate repository split**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/settings/crm-settings.service.spec.ts \
  apps/server/src/modules/crm/accounts/crm-account.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-sequence.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-sequence-send.service.spec.ts \
  apps/server/src/modules/crm/inbox/crm-inbox.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

Expected: old store spec either still passes or has been split into domain repository specs with identical behavior coverage.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM Prisma 仓储"
```

---

## Phase 10: Split Controllers Without Changing Routes

**Files:**
- Create: `apps/server/src/modules/crm/controllers/crm-account.controller.ts`
- Create: `apps/server/src/modules/crm/controllers/crm-settings.controller.ts`
- Create: `apps/server/src/modules/crm/controllers/crm-mailbox.controller.ts`
- Create: `apps/server/src/modules/crm/controllers/crm-sequence.controller.ts`
- Create: `apps/server/src/modules/crm/controllers/crm-inbox.controller.ts`
- Create: `apps/server/src/modules/crm/controllers/crm-dashboard.controller.ts`
- Modify: `apps/server/src/modules/crm/crm.controller.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Move account routes**

Move these routes from `CrmController` to `CrmAccountController`:

```text
GET /crm/accounts
POST /crm/accounts/import-lead
GET /crm/accounts/:id
PATCH /crm/accounts/:id/status
POST /crm/accounts/:id/notes
POST /crm/accounts/:id/archive
POST /crm/accounts/:id/restore
POST /crm/contacts/:id/verify-email
```

- [ ] **Step 2: Move settings routes**

Move:

```text
GET/POST /crm/global-config
GET/PATCH /crm/ai-draft-queue-config
GET/POST /crm/send-preference
GET/POST /crm/organization-config
product-lines routes
persona-profiles routes
email-template-groups routes
template-defaults route
sequence-policies routes
blacklist list/delete routes if UI treats them as settings
```

- [ ] **Step 3: Move mailbox routes**

Move:

```text
POST /crm/mailboxes/mock-authorize
POST /crm/mailboxes/gmail/oauth-url
POST /crm/mailboxes/gmail/oauth-callback
GET /crm/mailboxes
PATCH /crm/mailboxes/:id/pause
PATCH /crm/mailboxes/:id/resume
POST /crm/mailboxes/:id/renew-watch
POST /crm/mailboxes/:id/sync-now
```

- [ ] **Step 4: Move sequence routes**

Move:

```text
GET /crm/strategy-stats if not moved to dashboard controller
GET/POST /crm/sequence-review-items
GET /crm/sequence-review-items/:id
POST /crm/sequence-review-items/batch-generate-next-draft
POST /crm/sequence-review-items/batch-approve-draft
POST /crm/sequence-review-items/batch-stop
POST /crm/ai-drafts/preview
message draft/version/approve routes
sequence start/generate-next/stop routes
ai-draft-task routes
POST /crm/operations/send-queue/reconcile
```

- [ ] **Step 5: Move inbox routes**

Move:

```text
GET /crm/inbox-threads
GET /crm/inbox-threads/:id
PATCH /crm/inbox-threads/:id/status
POST /crm/inbox-threads/:id/reply
POST /crm/inbox-threads/:id/ai-reply-polish
PATCH /crm/inbox-threads/:id/reply-draft
POST /crm/inbox-messages/:id/confirm-unsubscribe
POST /crm/messages/:id/mock-reply
```

- [ ] **Step 6: Move dashboard routes**

Move:

```text
GET /crm/workbench/overview
GET /crm/strategy-stats
```

- [ ] **Step 7: Keep route paths identical**

Every new controller should use `@Controller('crm')` and keep the same method-level route string. Do not introduce `/crm/accounts/...` double prefixes.

- [ ] **Step 8: Validate controller split**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm.controller.spec.ts
```

Expected: route handlers call the same services and return the same response shapes.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM 控制器"
```

---

## Phase 11: Split Nest Modules

**Files:**
- Create: `apps/server/src/modules/crm/crm-shared.module.ts`
- Create: `apps/server/src/modules/crm/accounts/crm-accounts.module.ts`
- Create: `apps/server/src/modules/crm/settings/crm-settings.module.ts`
- Create: `apps/server/src/modules/crm/suppression/crm-suppression.module.ts`
- Create: `apps/server/src/modules/crm/mailbox/crm-mailbox.module.ts`
- Create: `apps/server/src/modules/crm/sequence/crm-sequence.module.ts`
- Create: `apps/server/src/modules/crm/inbox/crm-inbox.module.ts`
- Create: `apps/server/src/modules/crm/dashboard/crm-dashboard.module.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Create `CrmSharedModule`**

Export only shared helpers that are actual providers, such as `CrmLoggerService`. Pure functions stay as direct imports.

- [ ] **Step 2: Create feature modules**

Each module owns its service, repository provider, and controller if controller has already been split.

Example:

```ts
@Module({
  imports: [CrmSharedModule],
  controllers: [CrmAccountController],
  providers: [
    CrmAccountService,
    {
      provide: CRM_ACCOUNT_REPOSITORY,
      useClass: PrismaCrmAccountRepository
    }
  ],
  exports: [CrmAccountService, CRM_ACCOUNT_REPOSITORY]
})
export class CrmAccountsModule {}
```

- [ ] **Step 3: Avoid circular dependencies with small command ports**

If `inbox` needs to stop sequences, inject a narrow port:

```ts
export interface CrmSequenceReplyPolicyPort {
  stopSequencesAfterCustomerReply(input: {
    organizationId: string;
    ownerUserId: string;
    accountId: string;
    repliedAt: Date;
  }): Promise<void>;
}
```

Do not import the whole `CrmSequenceService` if only one operation is needed.

- [ ] **Step 4: Keep root `CrmModule` as aggregator**

`CrmModule` imports all CRM submodules and exports only stable public services needed by other modules.

- [ ] **Step 5: Validate module wiring**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts
```

Expected: no circular import failures, no missing provider errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 拆分 CRM Nest 模块"
```

---

## Phase 12: Remove Compatibility Facade And Legacy Artifacts

**Files:**
- Modify or delete: `apps/server/src/modules/crm/crm.service.ts`
- Delete: legacy repository adapters that still depend on `CRM_STORE`
- Delete: `apps/server/src/modules/crm/store/prisma-crm.store.ts` only after all Prisma domain repositories own its behavior
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: all CRM specs still importing legacy artifacts

- [ ] **Step 1: Confirm no production dependency on `CrmService` facade**

```bash
rg -n "CrmService|CRM_STORE|LegacyCrm|PrismaCrmStore" apps/server/src/modules apps/server/src/shared
```

Expected: no production call path depends on the facade or legacy store.

- [ ] **Step 2: Delete facade only after controller split is complete**

If other modules still import `CrmService`, keep a tiny exported facade with only the methods other modules actually need. Do not reintroduce the god service.

- [ ] **Step 3: Delete legacy adapters**

Remove:

```text
legacy-crm-account.repository.ts
legacy-crm-settings.repository.ts
legacy-crm-suppression.repository.ts
legacy-crm-mailbox.repository.ts
legacy-crm-sequence.repository.ts
legacy-crm-inbox.repository.ts
legacy-crm-dashboard.repository.ts
```

- [ ] **Step 4: Final validation**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/accounts/crm-account.service.spec.ts \
  apps/server/src/modules/crm/settings/crm-settings.service.spec.ts \
  apps/server/src/modules/crm/suppression/crm-suppression.service.spec.ts \
  apps/server/src/modules/crm/mailbox/crm-mailbox.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-sequence.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-draft.service.spec.ts \
  apps/server/src/modules/crm/sequence/crm-sequence-send.service.spec.ts \
  apps/server/src/modules/crm/inbox/crm-inbox.service.spec.ts \
  apps/server/src/modules/crm/dashboard/crm-dashboard.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts
```

Expected: focused domain tests replace the giant old service/store tests without losing high-risk business coverage.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "refactor: 移除 CRM 兼容门面"
```

---

## Final Acceptance Checklist

- [ ] `CrmService` is gone or reduced to a tiny cross-module facade.
- [ ] No single CRM service exceeds roughly 800 lines.
- [ ] No single CRM repository owns unrelated domains.
- [ ] Controller routes remain frontend-compatible.
- [ ] Owner-only write operations use `createCrmOwnerWriteScope`.
- [ ] Organization-wide reads use `createCrmReadScope`.
- [ ] Admin-only configuration writes use `requireCrmOrganizationAdminScope`.
- [ ] Draft approval cannot be done by organization admin for another member.
- [ ] Send start remains owner-only.
- [ ] Worker send claim still checks `runVersion`, status, mailbox, blacklist, and quota in one transaction.
- [ ] Inbox ingest remains idempotent by provider message id.
- [ ] Gmail 403 rate-limit errors are not treated as authorization expiry.
- [ ] `process.env` reads for CRM runtime behavior are centralized behind app config.
- [ ] No broad `@Optional()` remains for required production dependencies.
- [ ] No unrelated Prisma generated diffs are included.
- [ ] No `npm run build` was required for this refactor.

## Recommended Commit Boundaries

```text
1. refactor: 添加 CRM 共享上下文和 scope
2. refactor: 添加 CRM 仓储端口
3. refactor: 拆分 CRM 配置服务
4. refactor: 拆分 CRM 线索和黑名单服务
5. refactor: 拆分 CRM 邮箱和 Gmail 边界
6. refactor: 拆分 CRM 序列和发送服务
7. refactor: 拆分 CRM 收件箱服务
8. refactor: 拆分 CRM 工作台读模型
9. refactor: 拆分 CRM Prisma 仓储
10. refactor: 拆分 CRM 控制器
11. refactor: 拆分 CRM Nest 模块
12. refactor: 移除 CRM 兼容门面
```
