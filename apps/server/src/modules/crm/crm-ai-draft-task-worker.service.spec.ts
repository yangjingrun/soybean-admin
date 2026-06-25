import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmAiDraftTaskQueueService, toCrmAiDraftTaskJobId } from './crm-ai-draft-task-queue.service';
import { CrmAiDraftTaskWorkerService } from './crm-ai-draft-task-worker.service';
import type { CrmUserContext } from './shared/crm-context';
import type { CrmAiDraftPromptInput } from './crm-ai-draft.types';
import type { CrmAiDraftTaskItemRecord, CrmAiDraftTaskQueueJob, CrmAiDraftTaskRecord } from './crm-ai-draft-task.types';
import type { CrmAiDraftWorkerRepository } from './crm-ai-draft-worker.repository';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmFirstOutreachDraftBundleCreateInput,
  CrmFollowUpDraftBundleCreateInput,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmProductLineRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequenceReviewRecord
} from './crm.types';

describe('CrmAiDraftTaskQueueService', () => {
  it('enqueues AI draft task jobs with deterministic task run ids and shared concurrency', async () => {
    const addCalls: Array<{
      name: string;
      input: unknown;
      options: { jobId?: string; removeOnComplete?: boolean; removeOnFail?: unknown };
    }> = [];
    const removedJobIds: string[] = [];
    const globalConcurrencies: number[] = [];
    const service = new CrmAiDraftTaskQueueService({
      createBullMqConnectionOptions: () => ({})
    } as never);
    const realQueue = (service as never as { queue: { close(): Promise<void> } }).queue;
    await realQueue.close();

    (service as never as { queue: unknown }).queue = {
      async waitUntilReady() {},
      async add(
        name: string,
        input: unknown,
        options: { jobId?: string; removeOnComplete?: boolean; removeOnFail?: unknown }
      ) {
        addCalls.push({ name, input, options });

        return { id: options.jobId };
      },
      async getJob(jobId: string) {
        return {
          async remove() {
            removedJobIds.push(jobId);
          }
        };
      },
      async setGlobalConcurrency(concurrency: number) {
        globalConcurrencies.push(concurrency);
      }
    };

    const job: CrmAiDraftTaskQueueJob = {
      taskId: 'task-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 3
    };

    const result = await service.enqueueTask(job);
    await service.removeTaskJob('crm-ai-draft-task__task-1__3');
    await service.applyGlobalConcurrency(4);

    assert.equal(result.jobId, 'crm-ai-draft-task__task-1__3');
    assert.equal(toCrmAiDraftTaskJobId('task-1', 3), 'crm-ai-draft-task__task-1__3');
    assert.equal(result.jobId.includes(':'), false);
    assert.deepEqual(addCalls[0], {
      name: 'crm-ai-draft-task',
      input: job,
      options: {
        jobId: 'crm-ai-draft-task__task-1__3',
        removeOnComplete: true,
        removeOnFail: { age: 604_800, count: 1000 }
      }
    });
    assert.deepEqual(removedJobIds, ['crm-ai-draft-task__task-1__3']);
    assert.deepEqual(globalConcurrencies, [4]);
  });
});

describe('CrmAiDraftTaskWorkerService', () => {
  it('generates the first outreach email into a queued placeholder sequence', async () => {
    const store = createWorkerStore({
      items: [
        createTaskItem({
          stepIndex: 1,
          metadata: { kind: 'first_outreach' }
        })
      ],
      reviewItem: createReviewItem({
        enrollment: createEnrollment({ status: 'draft_review_pending' }),
        firstMessage: null,
        messages: [],
        mailbox: createMailbox()
      })
    });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(
      store as never,
      aiDraftService as never,
      undefined,
      createAvailabilityService() as never
    );

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 1);
    assert.equal(aiDraftService.calls[0].input.stepIndex, 1);
    assert.deepEqual(aiDraftService.calls[0].input.previousMessages, []);
    assert.equal(store.firstOutreachBundles.length, 1);
    assert.deepEqual(store.firstOutreachBundles[0].taskGuard, {
      taskId: 'task-1',
      runVersion: 1,
      status: 'running'
    });
    assert.equal(store.firstOutreachBundles[0].message.status, 'draft_ready');
    assert.equal(store.firstOutreachBundles[0].message.subject, 'AI subject');
    assert.equal(store.firstOutreachBundles[0].nextEnrollmentStatus, 'sequence_running');
    assert.equal(store.firstOutreachBundles[0].accountStatus, 'sequence_running');
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'succeeded');
    assert.equal(store.task.status, 'completed');
  });

  it('generates first outreach with built-in defaults when product-line step prompts are empty', async () => {
    const store = createWorkerStore({
      items: [
        createTaskItem({
          stepIndex: 1,
          metadata: { kind: 'first_outreach' }
        })
      ],
      reviewItem: createReviewItem({
        enrollment: createEnrollment({ status: 'draft_review_pending' }),
        firstMessage: null,
        messages: [],
        mailbox: createMailbox(),
        productLine: createProductLine({ aiWritingConfig: createEmptyPromptAiWritingConfig() })
      })
    });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(
      store as never,
      aiDraftService as never,
      undefined,
      createAvailabilityService() as never
    );

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 1);
    assert.equal(store.firstOutreachBundles.length, 1);
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'succeeded');
    assert.equal(store.task.status, 'completed');
  });

  it('generates one eligible local follow-up draft and completes the task with notification', async () => {
    const store = createWorkerStore();
    const aiDraftService = createAiDraftService();
    const notifications = createNotificationRecorder();
    const worker = new CrmAiDraftTaskWorkerService(
      store as never,
      aiDraftService as never,
      notifications.service as never
    );

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 1);
    assert.equal(aiDraftService.calls[0].input.stepIndex, 2);
    assert.equal(aiDraftService.calls[0].context.userId, 'user-1');
    assert.equal(store.followUpBundles.length, 1);
    assert.deepEqual(store.followUpBundles[0].taskGuard, {
      taskId: 'task-1',
      runVersion: 1,
      status: 'running'
    });
    assert.equal(store.followUpBundles[0].message.status, 'draft_ready');
    assert.equal(store.followUpBundles[0].message.subject, 'AI subject');
    assert.equal(store.followUpBundles[0].message.bodyText, 'AI body');
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'succeeded');
    assert.equal(store.task.status, 'completed');
    assert.deepEqual(store.task.resultSummary, {
      requestedCount: 1,
      successCount: 1,
      skippedCount: 0,
      failedCount: 0
    });
    assert.equal(notifications.records.length, 1);
    assert.equal(notifications.records[0].type, 'crm_ai_draft_task_completed');
    assert.equal(notifications.records[0].targetId, 'task-1');
    assert.equal(store.task.readAt, null);
    assert.equal(store.sendQueueCalls, 0);
  });

  it('treats legacy tasks without organization role as member context', async () => {
    const store = createWorkerStore({
      task: createTask({ organizationRole: null })
    });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 1);
    assert.equal(aiDraftService.calls[0].context.organizationRole, 'member');
    assert.equal(store.task.status, 'completed');
  });

  it('business-skips an item after owner-only recheck without calling AI or send queue', async () => {
    const store = createWorkerStore({
      reviewItem: createReviewItem({
        contact: createContact({ emailStatus: 'unsubscribed' })
      })
    });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.deepEqual(store.reviewLookups[0], {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.equal(aiDraftService.calls.length, 0);
    assert.equal(store.followUpBundles.length, 0);
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'skipped');
    assert.equal(store.itemUpdates.at(-1)?.patch.failureType, 'business_skip');
    assert.match(store.itemUpdates.at(-1)?.patch.failureReason ?? '', /退订/);
    assert.equal(store.task.status, 'completed');
    assert.equal(store.task.skippedCount, 1);
    assert.equal(store.sendQueueCalls, 0);
  });

  it('business-skips the item when local draft creation loses the state guard race', async () => {
    const store = createWorkerStore({ followUpBundleResult: null });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 1);
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'skipped');
    assert.equal(store.itemUpdates.at(-1)?.patch.failureType, 'business_skip');
    assert.equal(store.itemUpdates.at(-1)?.patch.failureReason, '当前草稿状态已变化，请刷新后重试');
    assert.equal(store.task.status, 'completed');
    assert.equal(store.task.runningCount, 0);
  });

  it('recovers a previously running item instead of completing around it', async () => {
    const store = createWorkerStore({ items: [createTaskItem({ status: 'running', attemptCount: 1 })] });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 1);
    assert.equal(store.itemUpdates[0].patch.status, 'running');
    assert.equal(store.itemUpdates[0].patch.attemptCount, 2);
    assert.deepEqual(store.itemUpdates[0].guard?.status, ['pending', 'retrying', 'running']);
    assert.equal(store.task.status, 'completed');
    assert.equal(store.task.successCount, 1);
  });

  it('fails the task when an item remains unfinished after processing', async () => {
    const store = createWorkerStore({
      items: [createTaskItem(), createTaskItem({ id: 'item-2', enrollmentId: 'enrollment-2', status: 'pending' })]
    });
    store.updateAiDraftTaskItem = async (id, patch, guard) => {
      store.itemUpdates.push({ id, patch, guard });
      const item = store.items.find(record => record.id === id);

      if (!item || id === 'item-2') return null;
      Object.assign(item, patch);

      return item;
    };
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.equal(store.task.status, 'failed');
    assert.equal(store.task.failureReason, '部分草稿未完成，请重试失败项');
  });

  it('retries retryable AI failures before succeeding the item', async () => {
    const store = createWorkerStore();
    const aiDraftService = createAiDraftService([Object.assign(new Error('rate limit exceeded'), { status: 429 })]);
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 2);
    assert.equal(
      store.itemUpdates.some(update => update.patch.status === 'retrying'),
      true
    );
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'succeeded');
    assert.equal(store.task.status, 'completed');
  });

  it('slows task concurrency down after clustered retryable failures', async () => {
    const store = createWorkerStore();
    const aiDraftService = createAiDraftService([
      Object.assign(new Error('temporary upstream timeout'), { status: 503 }),
      Object.assign(new Error('temporary upstream timeout'), { status: 503 })
    ]);
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob());

    assert.equal(aiDraftService.calls.length, 3);
    assert.equal(store.task.effectiveConcurrency, 1);
    assert.equal(store.task.progressState?.recentRetryableFailureCount, 2);
    assert.equal(store.task.progressState?.effectiveConcurrencyReason, 'retryable_failures_clustered');
    assert.equal(store.task.status, 'completed');
  });

  it('skips stale runVersion jobs without changing task or items', async () => {
    const store = createWorkerStore({ task: createTask({ runVersion: 2 }) });
    const aiDraftService = createAiDraftService();
    const worker = new CrmAiDraftTaskWorkerService(store as never, aiDraftService as never);

    await worker.processTaskJob(createJob({ runVersion: 1 }));

    assert.equal(aiDraftService.calls.length, 0);
    assert.equal(store.taskUpdates.length, 0);
    assert.equal(store.itemUpdates.length, 0);
    assert.equal(store.task.status, 'queued');
  });

  it('marks the task failed when any item fails and still notifies the owner', async () => {
    const store = createWorkerStore();
    const aiDraftService = createAiDraftService(new Error('AI unavailable'));
    const notifications = createNotificationRecorder();
    const worker = new CrmAiDraftTaskWorkerService(
      store as never,
      aiDraftService as never,
      notifications.service as never
    );

    await worker.processTaskJob(createJob());

    assert.equal(store.task.status, 'failed');
    assert.equal(store.task.failedCount, 1);
    assert.equal(store.itemUpdates.at(-1)?.patch.status, 'failed');
    assert.equal(notifications.records[0].type, 'crm_ai_draft_task_failed');
    assert.equal(store.sendQueueCalls, 0);
  });
});

function createWorkerStore(
  input: {
    task?: CrmAiDraftTaskRecord;
    items?: CrmAiDraftTaskItemRecord[];
    reviewItem?: CrmSequenceReviewRecord | null;
    followUpBundleResult?: 'default' | null;
    firstOutreachBundleResult?: 'default' | null;
  } = {}
) {
  const task = input.task ?? createTask();
  const items = input.items ?? [createTaskItem()];
  const reviewItem = input.reviewItem === undefined ? createReviewItem() : input.reviewItem;
  const followUpBundleResult = input.followUpBundleResult === undefined ? 'default' : input.followUpBundleResult;
  const firstOutreachBundleResult =
    input.firstOutreachBundleResult === undefined ? 'default' : input.firstOutreachBundleResult;
  const taskUpdates: Array<{
    patch: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTask']>[1];
    guard?: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTask']>[2];
  }> = [];
  const itemUpdates: Array<{
    id: string;
    patch: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTaskItem']>[1];
    guard?: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTaskItem']>[2];
  }> = [];
  const reviewLookups: Parameters<CrmAiDraftWorkerRepository['getSequenceReviewItem']>[0][] = [];
  const followUpBundles: CrmFollowUpDraftBundleCreateInput[] = [];
  const firstOutreachBundles: CrmFirstOutreachDraftBundleCreateInput[] = [];

  return {
    task,
    items,
    taskUpdates,
    itemUpdates,
    reviewLookups,
    followUpBundles,
    firstOutreachBundles,
    sendQueueCalls: 0,
    async findAiDraftTaskById(args: Parameters<CrmAiDraftWorkerRepository['findAiDraftTaskById']>[0]) {
      if (args.id !== task.id || args.organizationId !== task.organizationId || args.ownerUserId !== task.ownerUserId) {
        return null;
      }

      return task;
    },
    async listAiDraftTaskItems(args: Parameters<CrmAiDraftWorkerRepository['listAiDraftTaskItems']>[0]) {
      return items.filter(item => item.taskId === args.taskId);
    },
    async updateAiDraftTask(
      _id: string,
      patch: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTask']>[1],
      guard?: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTask']>[2]
    ) {
      taskUpdates.push({ patch, guard });
      if (guard?.runVersion && guard.runVersion !== task.runVersion) return null;
      if (guard?.status) {
        const statuses = Array.isArray(guard.status) ? guard.status : [guard.status];
        if (!statuses.includes(task.status)) return null;
      }

      Object.assign(task, patch);

      return task;
    },
    async updateAiDraftTaskItem(
      id: string,
      patch: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTaskItem']>[1],
      guard?: Parameters<CrmAiDraftWorkerRepository['updateAiDraftTaskItem']>[2]
    ) {
      itemUpdates.push({ id, patch, guard });
      const item = items.find(record => record.id === id);

      if (!item) return null;
      if (guard?.taskId && guard.taskId !== item.taskId) return null;
      if (guard?.status) {
        const statuses = Array.isArray(guard.status) ? guard.status : [guard.status];
        if (!statuses.includes(item.status)) return null;
      }

      Object.assign(item, patch);

      return item;
    },
    async getSequenceReviewItem(args: Parameters<CrmAiDraftWorkerRepository['getSequenceReviewItem']>[0]) {
      reviewLookups.push(args);

      return reviewItem;
    },
    async listBlacklistEntriesByEmailHashes(
      _args: Parameters<CrmAiDraftWorkerRepository['listBlacklistEntriesByEmailHashes']>[0]
    ) {
      return [];
    },
    async listMailboxSendScheduleTimes() {
      return [];
    },
    async getGlobalConfig() {
      return {
        followUpDelayDays: { step2Days: 3, step3Days: 7, step4Days: 12, step5Days: 18 }
      };
    },
    async getAiDraftQueueConfig() {
      return {
        configKey: 'crm-ai-draft',
        itemConcurrency: 3,
        maxItemConcurrency: 5,
        maxActiveTasksPerUser: 1,
        maxActiveTasksPerOrg: 2,
        maxAttempts: 3,
        retryBackoffSeconds: [0, 0, 0],
        updatedById: null,
        updatedByName: null,
        updatedAt: new Date('2026-06-20T10:00:00.000Z')
      };
    },
    async findDefaultEmailTemplateGroup() {
      return null;
    },
    async listActivePersonaProfiles() {
      return [];
    },
    async createFollowUpDraftBundle(bundleInput: CrmFollowUpDraftBundleCreateInput) {
      followUpBundles.push(bundleInput);

      if (followUpBundleResult === null) {
        return null;
      }

      return {
        enrollment: reviewItem?.enrollment ?? createEnrollment(),
        message: createMessage({
          id: 'generated-message-1',
          stepIndex: bundleInput.message.stepIndex,
          subject: bundleInput.message.subject,
          bodyText: bundleInput.message.bodyText,
          status: bundleInput.message.status,
          providerThreadId: bundleInput.message.providerThreadId
        }),
        event: { id: 'event-1' }
      };
    },
    async createFirstOutreachDraftBundle(bundleInput: CrmFirstOutreachDraftBundleCreateInput) {
      firstOutreachBundles.push(bundleInput);

      if (firstOutreachBundleResult === null) {
        return null;
      }

      return {
        enrollment: {
          ...(reviewItem?.enrollment ?? createEnrollment()),
          status: bundleInput.nextEnrollmentStatus
        },
        message: createMessage({
          id: 'generated-message-1',
          stepIndex: bundleInput.message.stepIndex,
          subject: bundleInput.message.subject,
          bodyText: bundleInput.message.bodyText,
          status: bundleInput.message.status,
          scheduledAt: bundleInput.message.scheduledAt
        }),
        account: createAccount({ status: bundleInput.accountStatus }),
        event: { id: 'event-1' }
      };
    },
    async startFirstMessageSend() {
      this.sendQueueCalls += 1;
      throw new Error('send queue must not be called by AI draft worker');
    }
  };
}

function createAiDraftService(error?: Error | Error[]) {
  const calls: Array<{ input: CrmAiDraftPromptInput; context: CrmUserContext }> = [];
  const errors = Array.isArray(error) ? [...error] : error ? [error] : [];

  return {
    calls,
    async generateDraft(input: CrmAiDraftPromptInput, context: CrmUserContext) {
      calls.push({ input, context });
      const nextError = errors.shift();
      if (nextError) throw nextError;

      return {
        subject: 'AI subject',
        bodyText: 'AI body',
        reason: 'matched product line',
        riskNotes: [],
        metadata: {
          generated: true,
          reason: 'matched product line',
          riskNotes: [],
          snapshot: {
            productLineId: 'product-line-1',
            productLineName: 'Bearing Series',
            stepIndex: 2,
            writingConfig: createAiWritingConfig(),
            reason: 'matched product line',
            riskNotes: [],
            generatedAt: new Date('2026-06-20T00:00:00.000Z').toISOString()
          }
        }
      };
    }
  };
}

function createNotificationRecorder() {
  const records: Array<{
    type: string;
    targetId: string;
  }> = [];

  return {
    records,
    service: {
      async create(input: { type: string; targetId: string }) {
        records.push(input);
      }
    }
  };
}

function createAvailabilityService() {
  return {
    evaluate() {
      return {
        canSend: true,
        nextAvailableAt: null,
        timeZone: 'Asia/Shanghai',
        reason: null
      };
    }
  };
}

function createJob(input: Partial<CrmAiDraftTaskQueueJob> = {}): CrmAiDraftTaskQueueJob {
  return {
    taskId: input.taskId ?? 'task-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    runVersion: input.runVersion ?? 1
  };
}

function createTask(input: Partial<CrmAiDraftTaskRecord> = {}): CrmAiDraftTaskRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'task-1',
    organizationId: input.organizationId ?? 'org-1',
    organizationRole: input.organizationRole === undefined ? 'member' : input.organizationRole,
    ownerUserId: input.ownerUserId ?? 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    status: input.status ?? 'queued',
    runVersion: input.runVersion ?? 1,
    bullJobId: input.bullJobId ?? 'task-1:1',
    requestedCount: input.requestedCount ?? 1,
    successCount: input.successCount ?? 0,
    skippedCount: input.skippedCount ?? 0,
    failedCount: input.failedCount ?? 0,
    retryingCount: input.retryingCount ?? 0,
    runningCount: input.runningCount ?? 0,
    pendingCount: input.pendingCount ?? 1,
    effectiveConcurrency: input.effectiveConcurrency ?? 2,
    maxAttempts: input.maxAttempts ?? 3,
    failureReason: input.failureReason ?? null,
    progressState: input.progressState ?? null,
    resultSummary: input.resultSummary ?? null,
    readAt: input.readAt ?? null,
    notifiedAt: input.notifiedAt ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createTaskItem(input: Partial<CrmAiDraftTaskItemRecord> = {}): CrmAiDraftTaskItemRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'item-1',
    taskId: input.taskId ?? 'task-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    enrollmentId: input.enrollmentId ?? 'enrollment-1',
    messageId: input.messageId ?? null,
    contactId: input.contactId ?? 'contact-1',
    accountId: input.accountId ?? 'account-1',
    productLineId: input.productLineId ?? 'product-line-1',
    stepIndex: input.stepIndex ?? 2,
    status: input.status ?? 'pending',
    attemptCount: input.attemptCount ?? 0,
    maxAttempts: input.maxAttempts ?? 3,
    failureType: input.failureType ?? null,
    failureReason: input.failureReason ?? null,
    draftSubject: input.draftSubject ?? null,
    draftBodyText: input.draftBodyText ?? null,
    metadata: input.metadata ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createReviewItem(input: Partial<CrmSequenceReviewRecord> = {}): CrmSequenceReviewRecord {
  const sourceMessage = input.messages?.at(-1) ?? createMessage();

  return {
    enrollment: input.enrollment ?? createEnrollment(),
    account: input.account ?? createAccount(),
    contact: input.contact ?? createContact(),
    productLine: input.productLine === undefined ? createProductLine() : input.productLine,
    mailbox: input.mailbox ?? null,
    policy: input.policy ?? null,
    firstMessage: input.firstMessage ?? sourceMessage,
    messages: input.messages ?? [sourceMessage]
  };
}

function createEnrollment(input: Partial<CrmSequenceEnrollmentRecord> = {}): CrmSequenceEnrollmentRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'enrollment-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    accountId: input.accountId ?? 'account-1',
    contactId: input.contactId ?? 'contact-1',
    mailboxId: input.mailboxId ?? null,
    productLineId: input.productLineId ?? 'product-line-1',
    policyId: input.policyId ?? null,
    name: input.name ?? 'ABC Trading sequence',
    status: input.status ?? 'ready_to_send',
    currentStep: input.currentStep ?? 1,
    totalSteps: input.totalSteps ?? 5,
    runVersion: input.runVersion ?? 1,
    createdById: input.createdById ?? 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createMessage(input: Partial<CrmMessageRecord> = {}): CrmMessageRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'message-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    enrollmentId: input.enrollmentId ?? 'enrollment-1',
    accountId: input.accountId ?? 'account-1',
    contactId: input.contactId ?? 'contact-1',
    mailboxId: input.mailboxId ?? null,
    stepIndex: input.stepIndex ?? 1,
    threadMode: input.threadMode ?? 'same_thread',
    subject: input.subject ?? 'Bearing Series for ABC Trading',
    bodyText: input.bodyText ?? 'Hi Ali, first message.',
    status: input.status ?? 'sent',
    scheduledAt: input.scheduledAt ?? null,
    sentAt: input.sentAt ?? null,
    providerMessageId: input.providerMessageId ?? 'provider-message-1',
    providerThreadId: input.providerThreadId ?? 'provider-thread-1',
    recipientTimeZone: input.recipientTimeZone ?? null,
    bullJobId: input.bullJobId ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createAccount(input: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'account-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    name: input.name ?? 'ABC Trading',
    normalizedName: input.normalizedName ?? 'abc trading',
    websiteUrl: input.websiteUrl ?? 'https://abc.example',
    domain: input.domain ?? 'abc.example',
    country: input.country ?? 'Saudi Arabia',
    city: input.city ?? null,
    address: input.address ?? null,
    timeZone: input.timeZone ?? null,
    customerType: input.customerType ?? 'distributor',
    status: input.status ?? 'ready',
    sourceTaskId: input.sourceTaskId ?? null,
    archivedAt: input.archivedAt ?? null,
    archiveReason: input.archiveReason ?? null,
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createContact(input: Partial<CrmContactRecord> = {}): CrmContactRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'contact-1',
    organizationId: input.organizationId ?? 'org-1',
    accountId: input.accountId ?? 'account-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    fullName: input.fullName ?? 'Ali Hassan',
    title: input.title ?? 'Purchasing Manager',
    email: input.email ?? 'ali@abc.example',
    emailHash: input.emailHash ?? 'email-hash-1',
    maskedEmail: input.maskedEmail ?? 'a***@abc.example',
    isPublicEmail: input.isPublicEmail ?? false,
    emailStatus: input.emailStatus ?? 'valid',
    emailProgressStatus: input.emailProgressStatus ?? 'not_generated',
    emailProgressLabel: input.emailProgressLabel ?? '首封待生成',
    emailProgressAt: input.emailProgressAt ?? null,
    emailProgressMessageId: input.emailProgressMessageId ?? null,
    emailProgressStepIndex: input.emailProgressStepIndex ?? null,
    emailProgressTotalSteps: input.emailProgressTotalSteps ?? null,
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createMailbox(input: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'mailbox-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    provider: input.provider ?? 'gmail',
    emailAddress: input.emailAddress ?? 'alice@example.com',
    emailHash: input.emailHash ?? 'mailbox-hash-1',
    maskedEmail: input.maskedEmail ?? 'a***@example.com',
    status: input.status ?? 'active',
    dailyLimit: input.dailyLimit ?? 50,
    hourlyLimit: input.hourlyLimit ?? 10,
    warmupStage: input.warmupStage ?? 'ready',
    encryptedRefreshToken: input.encryptedRefreshToken ?? null,
    watchExpiration: input.watchExpiration ?? null,
    lastHistoryId: input.lastHistoryId ?? null,
    syncIssueType: input.syncIssueType ?? null,
    syncIssueAt: input.syncIssueAt ?? null,
    syncIssueMessage: input.syncIssueMessage ?? null,
    authorizedAt: input.authorizedAt ?? now,
    pausedAt: input.pausedAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createProductLine(input: Partial<CrmProductLineRecord> = {}): CrmProductLineRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: input.id ?? 'product-line-1',
    organizationId: input.organizationId ?? 'org-1',
    name: input.name ?? 'Bearing Series',
    targetCustomerType: input.targetCustomerType ?? 'distributor',
    coreSellingPoints: input.coreSellingPoints ?? 'Stable supply and certified bearings.',
    moq: input.moq ?? '100 pcs',
    leadTime: input.leadTime ?? '15 days',
    paymentTerms: input.paymentTerms ?? 'T/T',
    certifications: input.certifications ?? 'ISO',
    catalogUrl: input.catalogUrl ?? null,
    websiteUrl: input.websiteUrl ?? 'https://supplier.example',
    commonModelsText: input.commonModelsText ?? '6204, 6205',
    aiWritingConfig: input.aiWritingConfig ?? createAiWritingConfig(),
    status: input.status ?? 'active',
    createdById: input.createdById ?? 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createAiWritingConfig(): NonNullable<CrmProductLineRecord['aiWritingConfig']> {
  return {
    enabled: true,
    steps: [
      { stepIndex: 1, prompt: 'First touch.' },
      { stepIndex: 2, prompt: 'Follow up with a new angle.' },
      { stepIndex: 3, prompt: 'Mention delivery.' },
      { stepIndex: 4, prompt: 'Mention quality.' },
      { stepIndex: 5, prompt: 'Close politely.' }
    ]
  };
}

function createEmptyPromptAiWritingConfig(): NonNullable<CrmProductLineRecord['aiWritingConfig']> {
  return {
    enabled: true,
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
      prompt: ''
    }))
  };
}
