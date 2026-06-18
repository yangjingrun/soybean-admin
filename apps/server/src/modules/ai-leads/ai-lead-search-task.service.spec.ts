import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import { AiLeadSearchTaskService } from './ai-lead-search-task.service';
import type {
  AiLeadQueueConfigRecord,
  AiLeadQueueConfigStore,
  AiLeadSearchTaskCreateInput,
  AiLeadSearchTaskRecord,
  AiLeadSearchTaskStore
} from './ai-lead-search-task.types';

const user: UserInfo = {
  userId: 'u-1',
  userName: 'Soybean',
  roles: ['R_SUPER'],
  buttons: []
};
const ordinaryUser: UserInfo = {
  ...user,
  roles: []
};

describe('AiLeadSearchTaskService', () => {
  it('creates a queued task and enqueues it with the saved queue concurrency', async () => {
    const enqueued: Array<{ taskId: string; runVersion: number; priority: number }> = [];
    const appliedConcurrency: number[] = [];
    const taskStore = createTaskStore();
    const queueConfigStore = createQueueConfigStore({ workerConcurrency: 3 });
    const service = new AiLeadSearchTaskService(taskStore, queueConfigStore, {
      async enqueueSearchTask(input) {
        enqueued.push(input);
        return { jobId: `job-${input.taskId}` };
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency(concurrency) {
        appliedConcurrency.push(concurrency);
      }
    });

    const task = await service.createTask(
      {
        requirement: ' 找沙特轴承进口商 ',
        targetLeadCount: 20,
        keywordPlan: { serperSearchQueries: [] }
      },
      { user }
    );

    assert.equal(task.status, 'queued');
    assert.equal(task.requirement, '找沙特轴承进口商');
    assert.equal(task.bullJobId, 'job-task-1');
    assert.deepEqual(enqueued, [{ taskId: 'task-1', runVersion: 1, priority: 0 }]);
    assert.deepEqual(appliedConcurrency, [3]);
  });

  it('rejects creating another task while current user has an active task', async () => {
    const taskStore = createTaskStore({
      activeTask: createTask({ id: 'active-1', status: 'running' })
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('should not enqueue');
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    await assert.rejects(
      () =>
        service.createTask(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20,
            keywordPlan: { serperSearchQueries: [] }
          },
          { user }
        ),
      ConflictException
    );
  });

  it('marks a just-created task failed when BullMQ enqueue is unavailable', async () => {
    const taskStore = createTaskStore();
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('queue unavailable');
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    await assert.rejects(
      () =>
        service.createTask(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20,
            keywordPlan: { serperSearchQueries: [] }
          },
          { user }
        ),
      /queue unavailable/
    );

    const task = await taskStore.findTaskById('task-1');
    assert.equal(task?.status, 'failed');
    assert.equal(task?.finishedAt instanceof Date, true);
    assert.match(task?.errorMessage || '', /queue unavailable/);
  });

  it('keeps task creation successful when the queued event write fails', async () => {
    const enqueued: Array<{ taskId: string; runVersion: number; priority: number }> = [];
    const taskStore = createTaskStore({
      failEventTypes: ['task_queued']
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask(input) {
        enqueued.push(input);
        return { jobId: `job-${input.taskId}` };
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.createTask(
      {
        requirement: '找沙特轴承进口商',
        targetLeadCount: 20,
        keywordPlan: { serperSearchQueries: [] }
      },
      { user }
    );

    assert.equal(task.status, 'queued');
    assert.equal(task.bullJobId, 'job-task-1');
    assert.deepEqual(enqueued, [{ taskId: 'task-1', runVersion: 1, priority: 0 }]);
  });

  it('interrupts a running task without removing its active BullMQ job', async () => {
    const removedJobs: string[] = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'running', bullJobId: 'job-task-1' })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('should not enqueue');
      },
      async removeSearchTaskJob(jobId) {
        removedJobs.push(jobId);
      },
      async applyGlobalConcurrency() {}
    });

    const task = await service.interruptTask('task-1', { user });

    assert.equal(task.status, 'interrupted');
    assert.deepEqual(removedJobs, []);
  });

  it('discards a queued task and removes its waiting BullMQ job', async () => {
    const removedJobs: string[] = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'queued', bullJobId: 'job-task-1' })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('should not enqueue');
      },
      async removeSearchTaskJob(jobId) {
        removedJobs.push(jobId);
      },
      async applyGlobalConcurrency() {}
    });

    const task = await service.discardTask('task-1', { user });

    assert.equal(task.status, 'discarded');
    assert.deepEqual(removedJobs, ['job-task-1']);
  });

  it('marks task notifications read when a failed task is discarded', async () => {
    const markedTargets: Array<{ targetType: string; targetId: string; userId: string }> = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'failed' })]
    });
    const service = new AiLeadSearchTaskService(
      taskStore,
      createQueueConfigStore(),
      {
        async enqueueSearchTask() {
          throw new Error('should not enqueue');
        },
        async removeSearchTaskJob() {},
        async applyGlobalConcurrency() {}
      },
      undefined,
      undefined,
      {
        async markTargetReadForUser(targetType: string, targetId: string, userId: string) {
          markedTargets.push({ targetType, targetId, userId });
          return { count: 1 };
        }
      } as never
    );

    const task = await service.discardTask('task-1', { user });

    assert.equal(task.status, 'discarded');
    assert.deepEqual(markedTargets, [{ targetType: 'aiLeadSearchTask', targetId: 'task-1', userId: 'u-1' }]);
  });

  it('keeps discard successful and writes a task event when notification read fails', async () => {
    const events: string[] = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'failed' })],
      onEvent(eventType) {
        events.push(eventType);
      }
    });
    const service = new AiLeadSearchTaskService(
      taskStore,
      createQueueConfigStore(),
      {
        async enqueueSearchTask() {
          throw new Error('should not enqueue');
        },
        async removeSearchTaskJob() {},
        async applyGlobalConcurrency() {}
      },
      undefined,
      undefined,
      {
        async markTargetReadForUser() {
          throw new Error('notification store unavailable');
        }
      } as never
    );

    const task = await service.discardTask('task-1', { user });

    assert.equal(task.status, 'discarded');
    assert.deepEqual(events, ['task_discarded', 'task_notification_read_failed']);
  });

  it('still discards a queued task when the BullMQ job is already locked by a worker', async () => {
    const events: string[] = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'queued', bullJobId: 'job-task-1' })],
      onEvent(eventType) {
        events.push(eventType);
      }
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('should not enqueue');
      },
      async removeSearchTaskJob() {
        throw new Error('Job is locked');
      },
      async applyGlobalConcurrency() {}
    });

    const task = await service.discardTask('task-1', { user });

    assert.equal(task.status, 'discarded');
    assert.deepEqual(events, ['task_discarded', 'task_job_remove_failed']);
  });

  it('resumes an interrupted task by creating a new queued run version', async () => {
    const enqueued: Array<{ taskId: string; runVersion: number; priority: number }> = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'interrupted', runVersion: 1 })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask(input) {
        enqueued.push(input);
        return { jobId: `job-${input.taskId}-${input.runVersion}` };
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.resumeTask('task-1', { user });

    assert.equal(task.status, 'queued');
    assert.equal(task.runVersion, 2);
    assert.equal(task.bullJobId, 'job-task-1-2');
    assert.deepEqual(enqueued, [{ taskId: 'task-1', runVersion: 2, priority: 0 }]);
  });

  it('persists a resumed run version before enqueueing so fast workers can pick it up', async () => {
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'interrupted', runVersion: 1 })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask(input) {
        const task = await taskStore.findTaskById(input.taskId);

        assert.equal(task?.status, 'queued');
        assert.equal(task?.runVersion, input.runVersion);

        return { jobId: `job-${input.taskId}-${input.runVersion}` };
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.resumeTask('task-1', { user });

    assert.equal(task.status, 'queued');
    assert.equal(task.runVersion, 2);
  });

  it('marks task notifications read when a failed task is retried', async () => {
    const markedTargets: Array<{ targetType: string; targetId: string; userId: string }> = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'failed', runVersion: 1 })]
    });
    const service = new AiLeadSearchTaskService(
      taskStore,
      createQueueConfigStore(),
      {
        async enqueueSearchTask(input) {
          return { jobId: `job-${input.taskId}-${input.runVersion}` };
        },
        async removeSearchTaskJob() {},
        async applyGlobalConcurrency() {}
      },
      undefined,
      undefined,
      {
        async markTargetReadForUser(targetType: string, targetId: string, userId: string) {
          markedTargets.push({ targetType, targetId, userId });
          return { count: 1 };
        }
      } as never
    );

    const task = await service.retryTask('task-1', { user });

    assert.equal(task.status, 'queued');
    assert.equal(task.runVersion, 2);
    assert.deepEqual(markedTargets, [{ targetType: 'aiLeadSearchTask', targetId: 'task-1', userId: 'u-1' }]);
  });

  it('keeps retry successful and writes a task event when notification read fails', async () => {
    const events: string[] = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'failed', runVersion: 1 })],
      onEvent(eventType) {
        events.push(eventType);
      }
    });
    const service = new AiLeadSearchTaskService(
      taskStore,
      createQueueConfigStore(),
      {
        async enqueueSearchTask(input) {
          return { jobId: `job-${input.taskId}-${input.runVersion}` };
        },
        async removeSearchTaskJob() {},
        async applyGlobalConcurrency() {}
      },
      undefined,
      undefined,
      {
        async markTargetReadForUser() {
          throw new Error('notification store unavailable');
        }
      } as never
    );

    const task = await service.retryTask('task-1', { user });

    assert.equal(task.status, 'queued');
    assert.equal(task.runVersion, 2);
    assert.deepEqual(events, ['task_retried', 'task_notification_read_failed']);
  });

  it('returns the latest task when a fast worker advances before job id backfill', async () => {
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'interrupted', runVersion: 1 })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask(input) {
        await taskStore.updateTask(
          input.taskId,
          {
            status: 'running',
            startedAt: new Date('2026-06-18T01:10:00Z')
          },
          {
            userId: user.userId,
            status: 'queued',
            runVersion: input.runVersion
          }
        );

        return { jobId: `job-${input.taskId}-${input.runVersion}` };
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.resumeTask('task-1', { user });

    assert.equal(task.status, 'running');
    assert.equal(task.runVersion, 2);
    assert.equal(task.startedAt?.toISOString(), '2026-06-18T01:10:00.000Z');
  });

  it('clears stale progress and result when an interrupted task is resumed', async () => {
    const taskStore = createTaskStore({
      records: [
        createTask({
          id: 'task-1',
          status: 'interrupted',
          runVersion: 1,
          progressState: { type: 'workflow_failed', title: '旧失败状态' },
          result: { candidates: [{ title: 'Old' }] },
          readAt: new Date('2026-06-18T00:20:00Z'),
          finishedAt: new Date('2026-06-18T00:30:00Z')
        })
      ]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask(input) {
        return { jobId: `job-${input.taskId}-${input.runVersion}` };
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.resumeTask('task-1', { user });

    assert.equal(task.status, 'queued');
    assert.equal(task.progressState, null);
    assert.equal(task.result, null);
    assert.equal(task.readAt, null);
    assert.equal(task.finishedAt, null);
  });

  it('rejects marking unfinished tasks as read', async () => {
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'failed' })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('should not enqueue');
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    await assert.rejects(() => service.markTaskRead('task-1', { user }), ConflictException);
  });

  it('marks task notifications read when a completed task is confirmed', async () => {
    const markedTargets: Array<{ targetType: string; targetId: string; userId: string }> = [];
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'completed', readAt: null })]
    });
    const service = new AiLeadSearchTaskService(
      taskStore,
      createQueueConfigStore(),
      {
        async enqueueSearchTask() {
          throw new Error('not used');
        },
        async removeSearchTaskJob() {},
        async applyGlobalConcurrency() {}
      },
      undefined,
      undefined,
      {
        async markTargetReadForUser(targetType: string, targetId: string, userId: string) {
          markedTargets.push({ targetType, targetId, userId });
          return { count: 1 };
        }
      } as never
    );

    const task = await service.markTaskRead('task-1', { user });

    assert.equal(task.readAt instanceof Date, true);
    assert.deepEqual(markedTargets, [{ targetType: 'aiLeadSearchTask', targetId: 'task-1', userId: 'u-1' }]);
  });

  it('returns public search result without raw Serper details for ordinary users', async () => {
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'completed', result: createCompletedTaskResult() })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('not used');
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.getTaskById('task-1', { user: ordinaryUser });
    const result = task.result as {
      summary: { actionCount: number };
      candidates: Array<{ sourceLabel: string }>;
      serperResults: unknown[];
    };

    assert.equal(result.summary.actionCount, 1);
    assert.equal(result.candidates[0].sourceLabel, '公开线索');
    assert.deepEqual(result.serperResults, []);
  });

  it('keeps raw Serper details visible for super admin task reads', async () => {
    const rawResult = createCompletedTaskResult();
    const taskStore = createTaskStore({
      records: [createTask({ id: 'task-1', status: 'completed', result: rawResult })]
    });
    const service = new AiLeadSearchTaskService(taskStore, createQueueConfigStore(), {
      async enqueueSearchTask() {
        throw new Error('not used');
      },
      async removeSearchTaskJob() {},
      async applyGlobalConcurrency() {}
    });

    const task = await service.getTaskById('task-1', { user });

    assert.deepEqual(task.result, rawResult);
  });

  it('records a business log when saving queue concurrency config', async () => {
    const logRecorder = createLogRecorder();
    const taskStore = createTaskStore();
    const queueConfigStore = createQueueConfigStore({ workerConcurrency: 4 });
    const appliedConcurrency: number[] = [];
    const service = new AiLeadSearchTaskService(
      taskStore,
      queueConfigStore,
      {
        async enqueueSearchTask() {
          throw new Error('not used');
        },
        async removeSearchTaskJob() {},
        async applyGlobalConcurrency(concurrency) {
          appliedConcurrency.push(concurrency);
        }
      },
      undefined,
      logRecorder
    );

    await service.saveQueueConfig(4, { user });

    assert.deepEqual(appliedConcurrency, [4]);
    assert.equal(logRecorder.records.length, 1);
    assert.deepEqual(logRecorder.records[0], {
      level: 'info',
      status: 'success',
      module: 'ai-leads',
      action: 'save-queue-config',
      message: 'AI 获客任务配置已保存',
      userId: 'u-1',
      userName: 'Soybean',
      metadata: {
        workerConcurrency: 4
      }
    });
  });
});

function createTaskStore(
  options: {
    activeTask?: AiLeadSearchTaskRecord | null;
    records?: AiLeadSearchTaskRecord[];
    onEvent?: (eventType: string) => void;
    failEventTypes?: string[];
  } = {}
): AiLeadSearchTaskStore {
  const records: AiLeadSearchTaskRecord[] = options.records ?? [];

  return {
    async createTask(input: AiLeadSearchTaskCreateInput) {
      const record = createTask({
        id: 'task-1',
        userId: input.userId,
        userName: input.userName ?? null,
        requirement: input.requirement,
        targetLeadCount: input.targetLeadCount,
        keywordPlan: input.keywordPlan,
        status: 'queued',
        priority: input.priority,
        runVersion: 1
      });
      records.push(record);

      return record;
    },
    async createTaskIfNoCurrent(input: AiLeadSearchTaskCreateInput) {
      if (options.activeTask) {
        return null;
      }

      const current = records.find(record => ['queued', 'running', 'interrupted', 'failed'].includes(record.status));

      return current ? null : this.createTask(input);
    },
    async findCurrentTaskForUser() {
      return options.activeTask ?? null;
    },
    async findTaskById(id: string) {
      return records.find(record => record.id === id) ?? null;
    },
    async findTaskByIdForUser(id: string, userId: string) {
      return records.find(record => record.id === id && record.userId === userId) ?? null;
    },
    async updateTask(id, patch, guard) {
      const record = records.find(item => item.id === id);

      if (!record) return null;
      if (guard?.userId && record.userId !== guard.userId) return null;
      if (guard?.runVersion !== undefined && record.runVersion !== guard.runVersion) return null;
      if (guard?.status) {
        const statuses = Array.isArray(guard.status) ? guard.status : [guard.status];
        if (!statuses.includes(record.status)) return null;
      }
      Object.assign(record, patch, { updatedAt: new Date('2026-06-18T01:00:00Z') });

      return record;
    },
    async interruptRunningTasksForRecovery() {
      const runningRecords = records.filter(record => record.status === 'running');
      runningRecords.forEach(record => {
        Object.assign(record, {
          status: 'interrupted',
          errorMessage: '服务重启，采集任务已自动中断，可继续采集。'
        });
      });

      return runningRecords;
    },
    async createTaskEvent(input) {
      if (options.failEventTypes?.includes(input.eventType)) {
        throw new Error(`event write failed: ${input.eventType}`);
      }

      options.onEvent?.(input.eventType);

      return undefined;
    },
    async findQueryByRequestKey() {
      return null;
    },
    async upsertRunningQuery() {
      throw new Error('not used');
    },
    async completeQuery() {
      throw new Error('not used');
    },
    async failQuery() {
      throw new Error('not used');
    }
  };
}

function createQueueConfigStore(overrides: Partial<AiLeadQueueConfigRecord> = {}) {
  const store: AiLeadQueueConfigStore = {
    async getConfig() {
      return {
        configKey: 'ai-lead-search',
        workerConcurrency: 2,
        priorityStrategy: 'fifo',
        updatedAt: new Date('2026-06-18T00:00:00Z'),
        ...overrides
      };
    },
    async saveConfig(input) {
      return {
        configKey: 'ai-lead-search',
        workerConcurrency: input.workerConcurrency,
        priorityStrategy: 'fifo',
        updatedAt: new Date('2026-06-18T00:00:00Z')
      };
    }
  };

  return store;
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
    requirement: '找沙特轴承进口商',
    targetLeadCount: 20,
    keywordPlan: {},
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

function createCompletedTaskResult() {
  return {
    keywordOptimization: { serperSearchQueries: [] },
    keywordOptimizationText: '{}',
    qualityWarnings: [],
    serperRequests: [{ endpoint: 'search', requestBody: { q: 'bearing importer Saudi Arabia' } }],
    serperResults: [
      {
        endpoint: 'search',
        requestBody: { q: 'bearing importer Saudi Arabia' },
        result: {
          organic: [
            {
              title: 'Bearing House',
              link: 'https://bearing.example.com',
              snippet: 'bearing distributor'
            }
          ]
        }
      }
    ],
    decisions: [{ decision: { nextAction: 'stop' } }],
    candidates: [
      {
        sourceType: 'organic',
        title: 'Bearing House',
        url: 'https://bearing.example.com',
        snippet: 'bearing distributor'
      }
    ],
    stopReason: '所有查询已完成'
  };
}
