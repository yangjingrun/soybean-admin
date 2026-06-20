# CRM Store Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy `CRM_STORE` / `PrismaCrmStore` aggregate and retire `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts` without losing database transaction coverage.

**Architecture:** Keep the old aggregate only as a temporary compatibility adapter. Each remaining production consumer gets a small role-based repository port and a Prisma adapter composed from the already split stores. New store specs cover real Prisma query/transaction behavior before deleting matching sections from the old aggregate spec.

**Tech Stack:** NestJS DI tokens, TypeScript, Prisma, Node `tsx --test`, pnpm.

---

## Current State

- Do not touch current unrelated frontend worktree changes:
  - `src/service/api/crm.ts`
  - `src/service/api/crm/`
  - `src/views/crm/email-sequences/modules/*`
- Existing production `CRM_STORE` consumers:
  - `apps/server/src/modules/crm/crm-gmail-watch.service.ts`
  - `apps/server/src/modules/crm/crm-gmail-webhook.service.ts`
  - `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`
  - `apps/server/src/modules/crm/crm-send-scheduler.service.ts`
  - `apps/server/src/modules/crm/crm-send-worker.service.ts`
  - `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.ts`
  - `apps/server/src/modules/crm/crm-ai-draft-task-worker-host.service.ts`
  - `apps/server/src/modules/crm/crm-archive-slimming.service.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts` still protects real Prisma behavior for send claim/complete, Gmail watch renewal, inbox ingest, AI draft task transactions and archive slimming. Do not delete it until the matching new specs exist and pass.
- No new tests should be added to `prisma-crm.store.spec.ts`.

## File Structure

Create narrowly-scoped repository ports:

- `apps/server/src/modules/crm/crm-gmail-watch.repository.ts`
  - Port for Gmail watch, webhook and renewal mailbox operations.
- `apps/server/src/modules/crm/crm-send-scheduler.repository.ts`
  - Port for scheduler candidate queries, owner/mailbox send state and message queue marking.
- `apps/server/src/modules/crm/crm-send-worker.repository.ts`
  - Port for delivery claim, send completion/failure, auth expiry and follow-up template config.
- `apps/server/src/modules/crm/crm-archive-slimming.repository.ts`
  - Port for archived account listing and slimming.
- `apps/server/src/modules/crm/crm-ai-draft-worker.repository.ts`
  - Port for AI draft worker and host queue config/task/review/follow-up operations.

Create Prisma adapters:

- `apps/server/src/modules/crm/store/prisma-crm-gmail-watch.store.ts`
- `apps/server/src/modules/crm/store/prisma-crm-send-scheduler.store.ts`
- `apps/server/src/modules/crm/store/prisma-crm-send-worker.store.ts`
- `apps/server/src/modules/crm/store/prisma-crm-archive-slimming.store.ts`
- `apps/server/src/modules/crm/store/prisma-crm-ai-draft-worker.store.ts`

Create or extend focused Prisma specs:

- `apps/server/src/modules/crm/store/prisma-crm-gmail-watch.store.spec.ts`
- `apps/server/src/modules/crm/store/prisma-crm-send-scheduler.store.spec.ts`
- `apps/server/src/modules/crm/store/prisma-crm-send-worker.store.spec.ts`
- `apps/server/src/modules/crm/store/prisma-crm-archive-slimming.store.spec.ts`
- `apps/server/src/modules/crm/store/prisma-crm-ai-draft-worker.store.spec.ts`
- `apps/server/src/modules/crm/store/prisma-crm-inbox.store.spec.ts`

Modify shared DI files per slice:

- `apps/server/src/modules/crm/crm.tokens.ts`
- `apps/server/src/modules/crm/crm-module.providers.ts`
- `apps/server/src/modules/crm/crm-module.providers.spec.ts`

Delete only at the final task:

- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
- `CRM_STORE` token from `apps/server/src/modules/crm/crm.tokens.ts`

---

## Task 1: Gmail Watch/Webhook/Renewal Repository

**Files:**
- Create: `apps/server/src/modules/crm/crm-gmail-watch.repository.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-gmail-watch.store.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-gmail-watch.store.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-gmail-watch.service.ts`
- Modify: `apps/server/src/modules/crm/crm-gmail-webhook.service.ts`
- Modify: `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`
- Modify: `apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-gmail-webhook.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.spec.ts`

- [ ] **Step 1: Add the repository port**

```ts
import type { CrmStore } from './crm.types';

/** Data port for Gmail watch renewal, webhook mailbox lookup and manual sync. */
export type CrmGmailWatchRepository = Pick<
  CrmStore,
  | 'findMailboxById'
  | 'findMailboxByProviderAndEmailHash'
  | 'updateMailbox'
  | 'listMailboxesForWatchRenewal'
  | 'markMailboxAuthorizationExpired'
>;
```

- [ ] **Step 2: Add token and provider binding**

Add to `crm.tokens.ts`:

```ts
export const CRM_GMAIL_WATCH_REPOSITORY = Symbol('CRM_GMAIL_WATCH_REPOSITORY');
```

Add to `crm-module.providers.ts`:

```ts
{
  provide: CRM_GMAIL_WATCH_REPOSITORY,
  useClass: PrismaCrmGmailWatchStore
}
```

- [ ] **Step 3: Add the Prisma adapter**

```ts
@Injectable()
export class PrismaCrmGmailWatchStore implements CrmGmailWatchRepository {
  private readonly mailboxStore: PrismaCrmMailboxStore;

  constructor(prisma: PrismaService) {
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
  }

  findMailboxById(...args: Parameters<PrismaCrmMailboxStore['findMailboxById']>) {
    return this.mailboxStore.findMailboxById(...args);
  }

  findMailboxByProviderAndEmailHash(...args: Parameters<PrismaCrmMailboxStore['findMailboxByProviderAndEmailHash']>) {
    return this.mailboxStore.findMailboxByProviderAndEmailHash(...args);
  }

  updateMailbox(...args: Parameters<PrismaCrmMailboxStore['updateMailbox']>) {
    return this.mailboxStore.updateMailbox(...args);
  }

  listMailboxesForWatchRenewal(...args: Parameters<PrismaCrmMailboxStore['listMailboxesForWatchRenewal']>) {
    return this.mailboxStore.listMailboxesForWatchRenewal(...args);
  }

  markMailboxAuthorizationExpired(...args: Parameters<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']>) {
    return this.mailboxStore.markMailboxAuthorizationExpired(...args);
  }
}
```

- [ ] **Step 4: Cut services from `CRM_STORE`**

Replace constructor injection in watch, webhook and renewal services:

```ts
@Inject(CRM_GMAIL_WATCH_REPOSITORY)
private readonly store: CrmGmailWatchRepository
```

- [ ] **Step 5: Add focused Prisma specs before deleting old coverage**

Move/rewrite these old aggregate cases into `prisma-crm-gmail-watch.store.spec.ts`:

```text
lists active Gmail mailboxes that need watch renewal
finds and updates mailboxes through scoped identity reads before writes
advances mailbox Gmail history id with the current checkpoint guard
marks Gmail mailbox auth expired and pauses pending sends for that mailbox
```

- [ ] **Step 6: Run verification**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm-module.providers.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-webhook.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-gmail-watch.store.spec.ts
git diff --check
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "拆分 CRM Gmail watch 仓储"
```

---

## Task 2: Send Scheduler Repository

**Files:**
- Create: `apps/server/src/modules/crm/crm-send-scheduler.repository.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-send-scheduler.store.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-send-scheduler.store.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-send-scheduler.service.ts`
- Modify: `apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.spec.ts`

- [ ] **Step 1: Add repository port**

```ts
import type { CrmStore } from './crm.types';

/** Data port for selecting and reserving due CRM send jobs. */
export type CrmSendSchedulerRepository = Pick<
  CrmStore,
  | 'getGlobalConfig'
  | 'listDueSendCandidates'
  | 'listOwnerSendStates'
  | 'listMailboxSendStates'
  | 'updateMessage'
>;
```

- [ ] **Step 2: Add Prisma adapter**

Compose `PrismaCrmSettingsStore`, `PrismaCrmSendScheduleStore` and `PrismaCrmMessageDraftStore`. Delegate only the five methods in the port.

- [ ] **Step 3: Cut scheduler service injection**

```ts
@Inject(CRM_SEND_SCHEDULER_REPOSITORY)
private readonly store: CrmSendSchedulerRepository
```

- [ ] **Step 4: Add focused Prisma specs**

Rewrite these old aggregate cases into `prisma-crm-send-scheduler.store.spec.ts`:

```text
counts queued CRM messages for one owner send concurrency guard
batch loads owner send states with preferences and grouped message counts
batch loads mailbox send states with daily and hourly grouped counts
pushes due send candidate guards into the Prisma query
batch loads blacklists for due send candidates without per-candidate lookups
```

Do not duplicate service-level scheduler tests that already use fake stores.

- [ ] **Step 5: Verify**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm-module.providers.spec.ts \
  apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-send-scheduler.store.spec.ts
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "拆分 CRM 发送调度仓储"
```

---

## Task 3: Send Worker Repository

**Files:**
- Create: `apps/server/src/modules/crm/crm-send-worker.repository.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-send-worker.store.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-send-worker.store.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-send-worker.service.ts`
- Modify: `apps/server/src/modules/crm/crm-send-worker.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.spec.ts`

- [ ] **Step 1: Add repository port**

```ts
import type { CrmStore } from './crm.types';

/** Data port for guarded CRM email delivery and completion. */
export type CrmSendWorkerRepository = Pick<
  CrmStore,
  | 'claimFirstMessageSendDelivery'
  | 'completeFirstMessageSend'
  | 'failFirstMessageSend'
  | 'markMailboxAuthorizationExpired'
  | 'getGlobalConfig'
  | 'findDefaultEmailTemplateGroup'
>;
```

- [ ] **Step 2: Add Prisma adapter**

Compose `PrismaCrmSequenceStore`, `PrismaCrmMailboxStore`, `PrismaCrmSettingsStore` and `PrismaCrmEmailTemplateGroupStore`.

- [ ] **Step 3: Cut worker injection**

```ts
@Inject(CRM_SEND_WORKER_REPOSITORY)
private readonly store: CrmSendWorkerRepository
```

- [ ] **Step 4: Add focused Prisma specs**

Rewrite these old aggregate cases into `prisma-crm-send-worker.store.spec.ts`:

```text
starts first message sending with enrollment and message status guards
does not mutate sending state when active mailbox guard fails inside transaction
claims queued first message delivery by reserving daily and hourly mailbox quota
skips queued delivery and stops the sequence when the contact is organization blacklisted
claims queued follow-up delivery by the job message id instead of the first step
does not claim queued first message delivery when mailbox quota is exhausted
persists provider ids when completing first message send
creates only the next follow-up draft when completing first message send
reuses an existing local follow-up draft when completing first message send
records the sent follow-up step when completing a later queued message
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm-module.providers.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-send-worker.store.spec.ts
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "拆分 CRM 发送 worker 仓储"
```

---

## Task 4: Inbox Prisma Spec Extraction

**Files:**
- Create: `apps/server/src/modules/crm/store/prisma-crm-inbox.store.spec.ts`
- Modify: `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`

- [ ] **Step 1: Add focused inbox store spec**

Move/rewrite these old aggregate cases into `prisma-crm-inbox.store.spec.ts` using `PrismaCrmInboxStore` directly:

```text
lists inbox threads with scoped filters and include data
updates inbox thread status and writes timeline event
saves inbox reply draft fields without creating messages or changing thread state
marks an inbox thread handled when Gmail removes UNREAD
archives an inbox thread when Gmail removes INBOX without deleting local messages
replies to inbox thread with mailbox sender and marks it handled
returns existing inbox message when ingesting duplicate provider message
rereads existing inbox message when concurrent ingest hits provider message uniqueness
stops all active same-account sequences and skips queued follow-ups after a customer reply
marks contact unsubscribed when ingesting an unsubscribe reply
confirms a pending unsubscribe review with blacklist and queued message updates in one transaction
marks contact unreachable when ingesting a bounce reply
```

- [ ] **Step 2: Delete only the migrated inbox cases from old aggregate spec**

Keep old aggregate cases for unrelated areas until their new specs exist.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/store/prisma-crm-inbox.store.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/crm/store/prisma-crm-inbox.store.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
git commit --no-verify -m "迁移 CRM inbox Prisma 测试"
```

---

## Task 5: Archive Slimming Repository

**Files:**
- Create: `apps/server/src/modules/crm/crm-archive-slimming.repository.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-archive-slimming.store.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-archive-slimming.store.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-archive-slimming.service.ts`
- Modify: `apps/server/src/modules/crm/crm-archive-slimming.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.spec.ts`

- [ ] **Step 1: Add repository port**

```ts
import type { CrmStore } from './crm.types';

/** Data port for CRM archived account slimming. */
export type CrmArchiveSlimmingRepository = Pick<
  CrmStore,
  'listAccountsForArchiveSlimming' | 'slimArchivedAccount'
>;
```

- [ ] **Step 2: Add Prisma adapter**

Compose `PrismaCrmAccountStore` and delegate the two archive methods.

- [ ] **Step 3: Cut service injection**

```ts
@Inject(CRM_ARCHIVE_SLIMMING_REPOSITORY)
private readonly store: CrmArchiveSlimmingRepository
```

- [ ] **Step 4: Add focused Prisma spec**

Rewrite this old aggregate case into `prisma-crm-archive-slimming.store.spec.ts`:

```text
lists and slims archived accounts after the recovery window
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm-module.providers.spec.ts \
  apps/server/src/modules/crm/crm-archive-slimming.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-archive-slimming.store.spec.ts
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "拆分 CRM 归档瘦身仓储"
```

---

## Task 6: AI Draft Worker Repository

**Files:**
- Create: `apps/server/src/modules/crm/crm-ai-draft-worker.repository.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-ai-draft-worker.store.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-ai-draft-worker.store.spec.ts`
- Modify: `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.ts`
- Modify: `apps/server/src/modules/crm/crm-ai-draft-task-worker-host.service.ts`
- Modify: `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.spec.ts`

- [ ] **Step 1: Add repository port**

```ts
import type { CrmStore } from './crm.types';

/** Data port for CRM AI draft task workers and worker host queue config. */
export type CrmAiDraftWorkerRepository = Pick<
  CrmStore,
  | 'getAiDraftQueueConfig'
  | 'findAiDraftTaskById'
  | 'listAiDraftTaskItems'
  | 'updateAiDraftTask'
  | 'updateAiDraftTaskItem'
  | 'getSequenceReviewItem'
  | 'createFollowUpDraftBundle'
  | 'listBlacklistEntriesByEmailHashes'
>;
```

- [ ] **Step 2: Add Prisma adapter**

Compose `PrismaCrmAiDraftTaskStore`, `PrismaCrmSettingsStore`, `PrismaCrmSequenceReviewStore`, `PrismaCrmSequenceStore` and `PrismaCrmSuppressionStore`.

- [ ] **Step 3: Cut worker and host injection**

Use the same repository token for both worker and host. The host only consumes `getAiDraftQueueConfig`, which is still a valid narrow subset.

- [ ] **Step 4: Add focused Prisma spec**

Rewrite these old aggregate cases into `prisma-crm-ai-draft-worker.store.spec.ts` or existing AI draft task store spec if one is created nearby:

```text
creates CRM AI draft task and item rows in one transaction with derived counters
rejects CRM AI draft task creation inside the serializable transaction when active cap is reached
maps serializable CRM AI draft task create conflicts to a business conflict result
returns default CRM AI draft queue config when no row exists
batch loads sequence review items by scoped ids
creates local follow-up draft bundles with scoped enrollment and timeline metadata
returns null without creating follow-up drafts when guards detect state changes
returns null before creating follow-up drafts when the task run guard no longer matches
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm-module.providers.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-ai-draft-worker.store.spec.ts
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm
git commit --no-verify -m "拆分 CRM AI 草稿 worker 仓储"
```

---

## Task 7: Old Aggregate Spec Shrink Pass

**Files:**
- Modify: `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`

- [ ] **Step 1: Delete migrated cases only**

Delete cases already covered by these new focused specs:

```text
prisma-crm-gmail-watch.store.spec.ts
prisma-crm-send-scheduler.store.spec.ts
prisma-crm-send-worker.store.spec.ts
prisma-crm-inbox.store.spec.ts
prisma-crm-archive-slimming.store.spec.ts
prisma-crm-ai-draft-worker.store.spec.ts
```

- [ ] **Step 2: Keep remaining cases grouped by current missing coverage**

If any old cases remain, add a top-of-file comment:

```ts
// Legacy aggregate coverage. Do not add new cases here; migrate or delete remaining cases with the owning repository.
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
git commit --no-verify -m "收缩 CRM legacy store 测试"
```

---

## Task 8: Remove `CRM_STORE` and `PrismaCrmStore`

**Files:**
- Delete: `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- Delete: `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.ts`
- Modify: `apps/server/src/modules/crm/crm-module.providers.spec.ts`
- Modify docs that still list `prisma-crm.store.spec.ts` as an active verification target only if they are current project docs, not historical handoff notes.

- [ ] **Step 1: Confirm zero production dependency**

```bash
rg "@Inject\\(CRM_STORE\\)|CRM_STORE|PrismaCrmStore" apps/server/src/modules/crm -n
```

Expected before deletion: only token/provider/spec references. No service or worker constructor should remain.

- [ ] **Step 2: Delete the aggregate**

Remove:

```text
apps/server/src/modules/crm/store/prisma-crm.store.ts
apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

- [ ] **Step 3: Delete token and provider binding**

Remove:

```ts
export const CRM_STORE = Symbol('CRM_STORE');
```

Remove the provider:

```ts
{
  provide: CRM_STORE,
  useClass: PrismaCrmStore
}
```

- [ ] **Step 4: Verify no legacy references**

```bash
rg "CRM_STORE|PrismaCrmStore|prisma-crm.store" apps/server/src docs/agent-memory.md docs/superpowers/plans -n
```

Expected: no active source references. Historical docs may remain only if clearly archival and not a command users are expected to run.

- [ ] **Step 5: Run final verification**

```bash
pnpm --filter @soybean/server typecheck
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm-module.providers.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-gmail-watch.store.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-send-scheduler.store.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-send-worker.store.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-inbox.store.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-archive-slimming.store.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm-ai-draft-worker.store.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-webhook.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts \
  apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-archive-slimming.service.spec.ts
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/crm docs
git commit --no-verify -m "移除 CRM legacy store 聚合"
```

---

## Parallelization Notes

- Safe parallel lanes after Task 1 token/provider conventions are settled:
  - Lane A: Task 2 send scheduler.
  - Lane B: Task 5 archive slimming.
  - Lane C: Task 6 AI draft worker.
- Do not run Task 2 and Task 3 in parallel in the same worktree unless agents coordinate `crm.tokens.ts`, `crm-module.providers.ts` and provider spec edits.
- Task 8 must be single-owner and last.

## Completion Gates

- `rg "@Inject\\(CRM_STORE\\)|CRM_STORE|PrismaCrmStore" apps/server/src/modules/crm -n` has no active source references.
- `apps/server/src/modules/crm/store/prisma-crm.store.ts` is deleted.
- `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts` is deleted.
- Focused Prisma specs exist for send worker, send scheduler, Gmail watch, inbox, archive slimming and AI draft worker behavior.
- `pnpm --filter @soybean/server typecheck` passes.
- Relevant CRM specs pass.
- `git diff --check` passes.

