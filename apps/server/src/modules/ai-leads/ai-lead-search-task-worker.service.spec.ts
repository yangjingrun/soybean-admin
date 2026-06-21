import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  AiLeadSearchContext,
  AiLeadSearchOrchestrator,
  BoundKeywordSearchDto,
  LeadSearchExecutionOptions,
  SearchRequestTrace
} from './ai-lead-search-orchestrator.service';
import { loadAppConfig } from '../app-config/app-config.loader';
import type { LeadSearchProgressReporter } from './ai-lead-search-progress';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import { AiLeadSearchTaskQueueService } from './ai-lead-search-task-queue.service';
import { AiLeadSearchTaskWorkerHost } from './ai-lead-search-task-worker-host.service';
import { AiLeadSearchTaskWorkerService } from './ai-lead-search-task-worker.service';
import type {
  AiLeadSearchTaskEventInput,
  AiLeadSearchTaskQueryRecord,
  AiLeadSearchTaskQueryStartInput,
  AiLeadSearchTaskRecord,
  AiLeadSearchTaskStore
} from './ai-lead-search-task.types';

describe('AiLeadSearchTaskWorkerService', () => {
  it('skips completed query checkpoints and completes the task', async () => {
    let defaultRunnerCalls = 0;
    const task = createTask({ status: 'queued' });
    const completedQuery = createQuery({
      requestKey: 'search|6204 bearing importer Saudi Arabia|sa|en|Saudi Arabia|1',
      status: 'completed',
      result: { organic: [{ title: 'Cached' }] }
    });
    const store = createTaskStore({ task, queries: [completedQuery] });
    const orchestrator = {
      async searchWithKeywordPlan(
        dto: BoundKeywordSearchDto,
        _context: AiLeadSearchContext,
        _reporter: LeadSearchProgressReporter | undefined,
        options: LeadSearchExecutionOptions
      ) {
        const request: SearchRequestTrace = {
          endpoint: 'search',
          requestBody: {
            q: '6204 bearing importer Saudi Arabia',
            gl: 'sa',
            hl: 'en',
            location: 'Saudi Arabia',
            num: 10,
            page: 1
          }
        };
        const result = await options.executeQuery?.(
          {
            request,
            requestKey: completedQuery.requestKey,
            requestIndex: 1
          },
          async () => {
            defaultRunnerCalls += 1;

            return { organic: [{ title: 'Fresh' }] };
          }
        );

        return {
          keywordOptimization: dto.keywordPlan,
          keywordOptimizationText: JSON.stringify(dto.keywordPlan),
          qualityWarnings: [],
          serperRequests: [request],
          serperResults: [{ ...request, result }],
          decisions: [],
          candidates: [],
          stopReason: '所有查询已完成'
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(defaultRunnerCalls, 0);
    assert.equal(task.status, 'completed');
    assert.deepEqual(task.result && typeof task.result === 'object' ? Object.keys(task.result) : [], [
      'keywordOptimization',
      'keywordOptimizationText',
      'qualityWarnings',
      'serperRequests',
      'serperResults',
      'decisions',
      'candidates',
      'stopReason'
    ]);
  });

  it('creates worker state events through the shared state-change shape', async () => {
    const events: AiLeadSearchTaskEventInput[] = [];
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({
      task,
      queries: [],
      onEvent(input) {
        events.push(input);
      }
    });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.deepEqual(events.slice(0, 2), [
      {
        taskId: task.id,
        eventType: 'task_started',
        title: '采集任务开始执行',
        message: null,
        fromStatus: 'queued',
        toStatus: 'running',
        metadata: null
      },
      {
        taskId: task.id,
        eventType: 'task_completed',
        title: '采集任务已完成',
        message: null,
        fromStatus: 'running',
        toStatus: 'completed',
        metadata: null
      }
    ]);
  });

  it('does not restart an interrupted task from a stale job', async () => {
    let orchestratorCalls = 0;
    const task = createTask({ status: 'interrupted' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        orchestratorCalls += 1;

        return {};
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(orchestratorCalls, 0);
    assert.equal(task.status, 'interrupted');
  });

  it('keeps an interrupted task from being completed after orchestration returns', async () => {
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        task.status = 'interrupted';

        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'interrupted');
    assert.equal(task.result, null);
  });

  it('does not move a discarded task back to running when the worker starts from a stale read', async () => {
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({
      task,
      queries: [],
      beforeUpdate(patch) {
        if (patch.status === 'running') {
          task.status = 'discarded';
        }
      }
    });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'discarded');
    assert.equal(task.result, null);
  });

  it('keeps an interrupted task interrupted when the active external call fails afterward', async () => {
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        task.status = 'interrupted';
        throw new Error('Serper timeout');
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'interrupted');
    assert.equal(task.errorMessage, null);
  });

  it('stops orchestration after a successful external call when the task was interrupted', async () => {
    let nextStepCalls = 0;
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan(
        dto: BoundKeywordSearchDto,
        _context: AiLeadSearchContext,
        _reporter: LeadSearchProgressReporter | undefined,
        options: LeadSearchExecutionOptions
      ) {
        const request: SearchRequestTrace = {
          endpoint: 'search',
          requestBody: {
            q: '6204 bearing importer Saudi Arabia',
            num: 10,
            page: 1
          }
        };

        await options.executeQuery?.(
          {
            request,
            requestKey: 'search|6204 bearing importer Saudi Arabia||||10|1|',
            requestIndex: 1
          },
          async () => {
            task.status = 'interrupted';

            return { organic: [{ title: 'Fresh' }] };
          }
        );

        nextStepCalls += 1;

        return {
          ...createSearchResult(),
          keywordOptimization: dto.keywordPlan
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(nextStepCalls, 0);
    assert.equal(task.status, 'interrupted');
    assert.equal(task.result, null);
  });

  it('keeps a completed task completed when notification creation fails', async () => {
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create() {
        throw new Error('notification unavailable');
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator, notificationService as never);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.ok(task.result);
  });

  it('creates the completion notification when the task completion event cannot be written', async () => {
    const notifications: Array<{ type: string; title: string }> = [];
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [], failEventTypes: ['task_completed'] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create(input: { type: string; title: string }) {
        notifications.push(input);
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator, notificationService as never);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'task_completed');
    assert.equal(notifications[0].title, '采集任务已完成');
  });

  it('keeps task notification metadata scoped to the task id', async () => {
    const notifications: Array<{ metadata?: Record<string, unknown> }> = [];
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create(input: { metadata?: Record<string, unknown> }) {
        notifications.push(input);
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator, notificationService as never);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.deepEqual(notifications[0].metadata, { taskId: task.id });
  });

  it('imports completed AI lead candidates into CRM with task organization context', async () => {
    const imports: Array<{ input: { name: string; websiteUrl?: string | null }; context: { organizationId: string } }> =
      [];
    const task = createTask({ status: 'queued', organizationId: 'org-1', organizationRole: 'member' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return {
          ...createSearchResult(),
          candidates: [{ title: 'ABC Bearing', website: 'https://abc.example' }]
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create() {}
    };
    const crmService = {
      async importAccountFromLead(
        input: { name: string; websiteUrl?: string | null },
        context: { organizationId: string }
      ) {
        imports.push({ input, context });
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(
      store,
      orchestrator,
      notificationService as never,
      crmService as never
    );

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.equal(imports.length, 1);
    assert.equal(imports[0].input.name, 'ABC Bearing');
    assert.equal(imports[0].input.websiteUrl, 'https://abc.example');
    assert.equal(imports[0].context.organizationId, 'org-1');
  });

  it('passes Hunter enriched contact to CRM import before importing completed candidates', async () => {
    const imports: Array<{ input: { name: string; contact?: { email?: string | null } | null } }> = [];
    const events: AiLeadSearchTaskEventInput[] = [];
    const task = createTask({ status: 'queued', organizationId: 'org-1', organizationRole: 'member' });
    const store = createTaskStore({
      task,
      queries: [],
      onEvent(input) {
        events.push(input);
      }
    });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return {
          ...createSearchResult(),
          candidates: [{ title: 'ABC Bearing', website: 'https://abc.example' }]
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create() {}
    };
    const crmService = {
      async importAccountFromLead(input: { name: string; contact?: { email?: string | null } | null }) {
        imports.push({ input });
      }
    };
    const hunterEnrichmentService = {
      async enrichCrmImportInputs(inputs: Array<{ name: string; contact?: { email?: string | null } | null }>) {
        return {
          inputs: inputs.map(input => ({
            ...input,
            contact: {
              fullName: 'Alice Buyer',
              title: 'Purchasing Manager',
              email: 'alice@abc.example'
            }
          })),
          attemptedCount: 1,
          enrichedCount: 1,
          failedCount: 0,
          firstErrorMessage: null
        };
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(
      store,
      orchestrator,
      notificationService as never,
      crmService as never,
      hunterEnrichmentService as never
    );

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.equal(imports.length, 1);
    assert.deepEqual(imports[0].input.contact, {
      fullName: 'Alice Buyer',
      title: 'Purchasing Manager',
      email: 'alice@abc.example'
    });
    assert.deepEqual(events.find(event => event.eventType === 'crm_hunter_enrichment_completed')?.metadata, {
      attemptedCount: 1,
      enrichedCount: 1,
      failedCount: 0,
      firstErrorMessage: null
    });
  });

  it('skips automatic Hunter enrichment when CRM already has provider history for the domain', async () => {
    let hunterCalls = 0;
    const importedNames: string[] = [];
    const task = createTask({ status: 'queued', organizationId: 'org-1', organizationRole: 'member' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return {
          ...createSearchResult(),
          candidates: [{ title: 'ABC Bearing', website: 'https://abc.example' }]
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create() {}
    };
    const crmService = {
      async filterLeadInputsForAutoEnrichment(inputs: Array<{ name: string }>) {
        return {
          inputsToEnrich: [],
          skippedExistingHistoryCount: inputs.length,
          skippedNoDomainCount: 0
        };
      },
      async importAccountFromLead(input: { name: string }) {
        importedNames.push(input.name);
      }
    };
    const hunterEnrichmentService = {
      async enrichCrmImportInputs() {
        hunterCalls += 1;

        return {
          inputs: [],
          attemptedCount: 1,
          enrichedCount: 0,
          failedCount: 0,
          firstErrorMessage: null
        };
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(
      store,
      orchestrator,
      notificationService as never,
      crmService as never,
      hunterEnrichmentService as never
    );

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.equal(hunterCalls, 0);
    assert.deepEqual(importedNames, ['ABC Bearing']);
  });

  it('imports domainless candidates without automatic Hunter enrichment', async () => {
    let hunterCalls = 0;
    const importedNames: string[] = [];
    const task = createTask({ status: 'queued', organizationId: 'org-1', organizationRole: 'member' });
    const store = createTaskStore({ task, queries: [] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return {
          ...createSearchResult(),
          candidates: [{ title: 'Local Bearing Shop', address: 'Riyadh' }]
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const crmService = {
      async filterLeadInputsForAutoEnrichment(inputs: Array<{ name: string }>) {
        return {
          inputsToEnrich: [],
          skippedExistingHistoryCount: 0,
          skippedNoDomainCount: inputs.length
        };
      },
      async importAccountFromLead(input: { name: string }) {
        importedNames.push(input.name);
      }
    };
    const hunterEnrichmentService = {
      async enrichCrmImportInputs() {
        hunterCalls += 1;

        return {
          inputs: [],
          attemptedCount: 1,
          enrichedCount: 0,
          failedCount: 0,
          firstErrorMessage: null
        };
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(
      store,
      orchestrator,
      undefined,
      crmService as never,
      hunterEnrichmentService as never
    );

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(hunterCalls, 0);
    assert.deepEqual(importedNames, ['Local Bearing Shop']);
  });

  it('continues CRM import with original inputs and records an event when Hunter enrichment fails', async () => {
    const importedContacts: Array<{ email?: string | null } | null | undefined> = [];
    const events: AiLeadSearchTaskEventInput[] = [];
    const task = createTask({ status: 'queued', organizationId: 'org-1', organizationRole: 'member' });
    const store = createTaskStore({
      task,
      queries: [],
      onEvent(input) {
        events.push(input);
      }
    });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return {
          ...createSearchResult(),
          candidates: [{ title: 'ABC Bearing', website: 'https://abc.example' }]
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create() {}
    };
    const crmService = {
      async importAccountFromLead(input: { contact?: { email?: string | null } | null }) {
        importedContacts.push(input.contact);
      }
    };
    const hunterEnrichmentService = {
      async enrichCrmImportInputs() {
        throw new Error('Hunter config missing');
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(
      store,
      orchestrator,
      notificationService as never,
      crmService as never,
      hunterEnrichmentService as never
    );

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.deepEqual(importedContacts, [null]);
    assert.deepEqual(events.find(event => event.eventType === 'crm_hunter_enrichment_failed')?.metadata, {
      attemptedCount: 0,
      enrichedCount: 0,
      failedCount: 1,
      firstErrorMessage: 'Hunter config missing'
    });
  });

  it('keeps completion notification when CRM import fails', async () => {
    const notifications: Array<{ type: string }> = [];
    const events: string[] = [];
    const importedNames: string[] = [];
    const task = createTask({ status: 'queued', organizationId: 'org-1', organizationRole: 'member' });
    const store = createTaskStore({
      task,
      queries: [],
      onEvent(input) {
        events.push(input.eventType);
      }
    });
    const orchestrator = {
      async searchWithKeywordPlan() {
        return {
          ...createSearchResult(),
          candidates: [
            { title: 'ABC Bearing', website: 'https://abc.example' },
            { title: 'XYZ Trading', website: 'https://xyz.example' }
          ]
        };
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create(input: { type: string }) {
        notifications.push(input);
      }
    };
    const crmService = {
      async importAccountFromLead(input: { name: string }) {
        if (input.name === 'ABC Bearing') {
          throw new Error('crm unavailable');
        }
        importedNames.push(input.name);
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(
      store,
      orchestrator,
      notificationService as never,
      crmService as never
    );

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.equal(notifications[0].type, 'task_completed');
    assert.deepEqual(importedNames, ['XYZ Trading']);
    assert.equal(events.includes('crm_import_failed'), true);
  });

  it('creates the failure notification and keeps the original failure when the task failure event cannot be written', async () => {
    const notifications: Array<{ type: string; title: string; content: string }> = [];
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [], failEventTypes: ['task_failed'] });
    const orchestrator = {
      async searchWithKeywordPlan() {
        throw new Error('Serper timeout');
      }
    } as unknown as AiLeadSearchOrchestrator;
    const notificationService = {
      async create(input: { type: string; title: string; content: string }) {
        notifications.push(input);
      }
    };
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator, notificationService as never);

    await assert.rejects(
      () => worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 }),
      /Serper timeout/
    );

    assert.equal(task.status, 'failed');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'task_failed');
    assert.equal(notifications[0].title, '采集任务失败');
    assert.equal(notifications[0].content, 'Serper timeout');
  });

  it('completes the task when progress state persistence fails', async () => {
    const task = createTask({ status: 'queued' });
    const store = createTaskStore({ task, queries: [], failProgressUpdate: true });
    const orchestrator = {
      async searchWithKeywordPlan(
        _dto: BoundKeywordSearchDto,
        _context: AiLeadSearchContext,
        reporter: LeadSearchProgressReporter | undefined
      ) {
        await reporter?.emit({
          type: 'step_progress',
          title: '采集进度',
          progressPercent: 30
        });

        return createSearchResult();
      }
    } as unknown as AiLeadSearchOrchestrator;
    const worker = new AiLeadSearchTaskWorkerService(store, orchestrator);

    await worker.processTaskJob({ taskId: task.id, runVersion: task.runVersion, priority: 0 });

    assert.equal(task.status, 'completed');
    assert.ok(task.result);
  });

  it('does not recover running tasks that still have active queue jobs', async () => {
    const recoveredJobIdGroups: string[][] = [];
    const task = createTask({ status: 'running', bullJobId: 'task-live:1' });
    const store = createTaskStore({
      task,
      queries: [],
      onRecover(activeJobIds) {
        recoveredJobIdGroups.push(activeJobIds);
      }
    });
    const worker = new AiLeadSearchTaskWorkerService(store, {} as AiLeadSearchOrchestrator);

    await worker.interruptRunningTasksAfterRestart(['task-live:1']);

    assert.deepEqual(recoveredJobIdGroups, [['task-live:1']]);
    assert.equal(task.status, 'running');
  });

  it('does not start the worker host in API-only runtime role', async () => {
    let configReads = 0;
    let activeJobReads = 0;
    const host = new AiLeadSearchTaskWorkerHost(
      { createBullMqConnectionOptions: () => ({}) } as never,
      {} as AiLeadSearchTaskWorkerService,
      {
        async getConfig() {
          configReads += 1;

          return { configKey: 'ai-lead-search', workerConcurrency: 1, priorityStrategy: 'fifo', updatedAt: new Date() };
        }
      } as never,
      {
        async removeSearchTaskJob() {},
        async enqueueSearchTask() {
          return { jobId: 'job-1' };
        },
        async applyGlobalConcurrency() {},
        async listActiveSearchTaskJobIds() {
          activeJobReads += 1;

          return [];
        }
      },
      undefined,
      { config: loadAppConfig({ SERVER_RUNTIME_ROLE: 'api' }) } as never
    );

    await host.onModuleInit();
    await host.onModuleDestroy();

    assert.equal(configReads, 0);
    assert.equal(activeJobReads, 0);
  });

  it('records worker host runtime errors through the injected log service', async () => {
    const logRecorder = createLogRecorder();
    const host = new AiLeadSearchTaskWorkerHost(
      { createBullMqConnectionOptions: () => ({}) } as never,
      {} as AiLeadSearchTaskWorkerService,
      {
        async getConfig() {
          return { configKey: 'ai-lead-search', workerConcurrency: 1, priorityStrategy: 'fifo', updatedAt: new Date() };
        }
      } as never,
      {
        async removeSearchTaskJob() {},
        async enqueueSearchTask() {
          return { jobId: 'job-1' };
        },
        async applyGlobalConcurrency() {}
      },
      logRecorder as never
    );

    await (host as never as { recordWorkerRuntimeError(error: unknown): Promise<void> }).recordWorkerRuntimeError(
      new Error('redis connection lost')
    );

    assert.deepEqual(logRecorder.records[0], {
      level: 'error',
      status: 'failed',
      module: 'ai-leads',
      action: 'worker-runtime-error',
      message: 'AI 获客 worker 运行期异常',
      errorMessage: 'redis connection lost',
      metadata: {
        errorCategory: 'unexpected',
        errorName: 'Error'
      }
    });
  });

  it('records worker host failed jobs through the injected log service', async () => {
    const logRecorder = createLogRecorder();
    const host = new AiLeadSearchTaskWorkerHost(
      { createBullMqConnectionOptions: () => ({}) } as never,
      {} as AiLeadSearchTaskWorkerService,
      {
        async getConfig() {
          return { configKey: 'ai-lead-search', workerConcurrency: 1, priorityStrategy: 'fifo', updatedAt: new Date() };
        }
      } as never,
      {
        async removeSearchTaskJob() {},
        async enqueueSearchTask() {
          return { jobId: 'job-1' };
        },
        async applyGlobalConcurrency() {}
      },
      logRecorder as never
    );

    await (host as never as { recordWorkerJobFailed(job: unknown, error: Error): Promise<void> }).recordWorkerJobFailed(
      { id: 'task-1:1', data: { taskId: 'task-1', runVersion: 1, priority: 0 } },
      new Error('worker failed')
    );

    assert.deepEqual(logRecorder.records[0], {
      level: 'error',
      status: 'failed',
      module: 'ai-leads',
      action: 'worker-job-failed',
      message: 'AI 获客 worker job 执行失败',
      errorMessage: 'worker failed',
      metadata: {
        jobId: 'task-1:1',
        taskId: 'task-1',
        runVersion: 1,
        errorCategory: 'unexpected',
        errorName: 'Error'
      }
    });
  });

  it('keeps a finite number of failed BullMQ jobs for operations inspection', async () => {
    let addOptions: { jobId?: string; removeOnFail?: unknown } | undefined;
    const service = new AiLeadSearchTaskQueueService({
      createBullMqConnectionOptions: () => ({})
    } as never);
    const realQueue = (service as never as { queue: { close(): Promise<void> } }).queue;
    await realQueue.close();

    (service as never as { queue: unknown }).queue = {
      async waitUntilReady() {},
      async add(_name: string, _input: unknown, options: { jobId?: string; removeOnFail?: unknown }) {
        addOptions = options;

        return { id: options.jobId };
      }
    };

    await service.enqueueSearchTask({ taskId: 'task-1', runVersion: 1, priority: 0 });

    assert.equal(addOptions?.jobId, 'ai-lead-search-task__task-1__1');
    assert.equal(addOptions?.jobId?.includes(':'), false);
    assert.deepEqual(addOptions?.removeOnFail, { age: 604_800, count: 1000 });
  });
});

function createTaskStore(options: {
  task: AiLeadSearchTaskRecord;
  queries: AiLeadSearchTaskQueryRecord[];
  beforeUpdate?: (patch: Partial<AiLeadSearchTaskRecord>) => void;
  onRecover?: (activeJobIds: string[]) => void;
  failEventTypes?: string[];
  failProgressUpdate?: boolean;
  onEvent?: (input: AiLeadSearchTaskEventInput) => void;
}): AiLeadSearchTaskStore {
  return {
    async createTask() {
      throw new Error('not used');
    },
    async createTaskIfNoCurrent() {
      throw new Error('not used');
    },
    async findCurrentTaskForUser() {
      return null;
    },
    async findTaskById(id) {
      return options.task.id === id ? options.task : null;
    },
    async findTaskByIdForUser() {
      return null;
    },
    async updateTask(id, patch, guard) {
      if (options.task.id !== id) return null;
      if (options.failProgressUpdate && 'progressState' in patch) {
        throw new Error('progress store unavailable');
      }
      options.beforeUpdate?.(patch as Partial<AiLeadSearchTaskRecord>);
      if (guard?.runVersion !== undefined && options.task.runVersion !== guard.runVersion) return null;
      if (guard?.status) {
        const statuses = Array.isArray(guard.status) ? guard.status : [guard.status];
        if (!statuses.includes(options.task.status)) return null;
      }
      Object.assign(options.task, patch, { updatedAt: new Date('2026-06-18T01:00:00Z') });

      return options.task;
    },
    async interruptRunningTasksForRecovery(activeJobIds = []) {
      options.onRecover?.(activeJobIds);

      if (options.task.status !== 'running' || activeJobIds.includes(options.task.bullJobId || '')) {
        return [];
      }

      Object.assign(options.task, {
        status: 'interrupted',
        errorMessage: '服务重启，采集任务已自动中断，可继续采集。'
      });

      return [options.task];
    },
    async createTaskEvent(input) {
      if (options.failEventTypes?.includes(input.eventType)) {
        throw new Error(`${input.eventType} event unavailable`);
      }
      options.onEvent?.(input);

      return undefined;
    },
    async findQueryByRequestKey(_taskId, requestKey) {
      return options.queries.find(query => query.requestKey === requestKey) ?? null;
    },
    async upsertRunningQuery(input: AiLeadSearchTaskQueryStartInput) {
      const query = createQuery({
        ...input,
        status: 'running'
      });
      options.queries.push(query);

      return query;
    },
    async completeQuery(id, result) {
      const query = options.queries.find(item => item.id === id);

      if (!query) throw new Error('query not found');
      Object.assign(query, { status: 'completed', result, errorMessage: null });

      return query;
    },
    async failQuery(id, errorMessage) {
      const query = options.queries.find(item => item.id === id);

      if (!query) throw new Error('query not found');
      Object.assign(query, { status: 'failed', errorMessage });

      return query;
    }
  };
}

function createLogRecorder() {
  return {
    records: [] as SystemLogRecordInput[],
    async record(input: SystemLogRecordInput) {
      this.records.push(input);
    }
  };
}

function createTask(overrides: Partial<AiLeadSearchTaskRecord>): AiLeadSearchTaskRecord {
  return {
    id: 'task-1',
    userId: 'u-1',
    userName: 'Soybean',
    organizationId: 'org-1',
    organizationRole: 'admin',
    requirement: '找沙特轴承进口商',
    targetLeadCount: 20,
    keywordPlan: { serperSearchQueries: [] },
    status: 'queued',
    priority: 0,
    runVersion: 1,
    progressState: null,
    result: null,
    errorMessage: null,
    bullJobId: null,
    readAt: null,
    notifiedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-06-18T00:00:00Z'),
    updatedAt: new Date('2026-06-18T00:00:00Z'),
    ...overrides
  };
}

function createQuery(overrides: Partial<AiLeadSearchTaskQueryRecord>): AiLeadSearchTaskQueryRecord {
  return {
    id: 'query-1',
    taskId: 'task-1',
    requestKey: 'request-key',
    endpoint: 'search',
    requestBody: {},
    status: 'pending',
    result: null,
    errorMessage: null,
    orderIndex: 1,
    createdAt: new Date('2026-06-18T00:00:00Z'),
    updatedAt: new Date('2026-06-18T00:00:00Z'),
    ...overrides
  };
}

function createSearchResult() {
  return {
    keywordOptimization: { serperSearchQueries: [] },
    keywordOptimizationText: '{}',
    qualityWarnings: [],
    serperRequests: [],
    serperResults: [],
    decisions: [],
    candidates: [],
    stopReason: '所有查询已完成'
  };
}
