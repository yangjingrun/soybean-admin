import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SystemNotificationService } from './system-notification.service';
import type {
  CreateSystemNotificationStoreInput,
  SystemNotificationListArgs,
  SystemNotificationRecord,
  SystemNotificationStatusUpdateArgs,
  SystemNotificationStore
} from './system-notification.types';

describe('SystemNotificationService', () => {
  it('queries unread notifications for current user by created time descending', async () => {
    const store = createStoreStub([
      createNotification({
        id: 'notification-1',
        userId: 'u-1',
        status: 'pending',
        createdAt: new Date('2026-06-18T02:00:00.000Z')
      })
    ]);
    const service = new SystemNotificationService(store);

    const result = await service.listPendingForUser('u-1');

    assert.deepEqual(store.lastListArgs, {
      where: {
        userId: 'u-1',
        status: ['pending', 'shown']
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'notification-1');
    assert.equal(result[0].createdAt, '2026-06-18T02:00:00.000Z');
  });

  it('keeps shown but unread notifications in the reminder list', async () => {
    const store = createStoreStub([
      createNotification({
        id: 'notification-1',
        userId: 'u-1',
        status: 'shown',
        shownAt: new Date('2026-06-18T02:00:00.000Z')
      })
    ]);
    const service = new SystemNotificationService(store);

    const result = await service.listPendingForUser('u-1');

    assert.deepEqual(store.lastListArgs?.where.status, ['pending', 'shown']);
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'shown');
    assert.equal(result[0].shownAt, '2026-06-18T02:00:00.000Z');
  });

  it('marks a notification as shown for the owner', async () => {
    const store = createStoreStub([]);
    const service = new SystemNotificationService(store);

    const result = await service.markShown('notification-1', 'u-1');

    assert.equal(store.lastStatusUpdateArgs?.id, 'notification-1');
    assert.equal(store.lastStatusUpdateArgs?.userId, 'u-1');
    assert.equal(store.lastStatusUpdateArgs?.status, 'shown');
    assert.equal(store.lastStatusUpdateArgs?.statusGuard, 'pending');
    assert.ok(store.lastStatusUpdateArgs?.shownAt instanceof Date);
    assert.equal(result.status, 'shown');
    assert.equal(result.shownAt, store.lastStatusUpdateArgs?.shownAt?.toISOString());
  });

  it('marks a notification as read for the owner', async () => {
    const store = createStoreStub([]);
    const service = new SystemNotificationService(store);

    const result = await service.markRead('notification-1', 'u-1');

    assert.equal(store.lastStatusUpdateArgs?.id, 'notification-1');
    assert.equal(store.lastStatusUpdateArgs?.userId, 'u-1');
    assert.equal(store.lastStatusUpdateArgs?.status, 'read');
    assert.ok(store.lastStatusUpdateArgs?.readAt instanceof Date);
    assert.equal(result.status, 'read');
    assert.equal(result.readAt, store.lastStatusUpdateArgs?.readAt?.toISOString());
  });

  it('marks unread notifications read by target for the owner', async () => {
    const store = createStoreStub([]);
    const service = new SystemNotificationService(store);

    const result = await (
      service as never as {
        markTargetReadForUser(targetType: string, targetId: string, userId: string): Promise<{ count: number }>;
      }
    ).markTargetReadForUser('aiLeadSearchTask', 'task-1', 'u-1');

    assert.deepEqual(store.lastTargetReadArgs, {
      targetType: 'aiLeadSearchTask',
      targetId: 'task-1',
      userId: 'u-1'
    });
    assert.equal(result.count, 2);
  });

  it('does not overwrite a notification that becomes read while marking shown', async () => {
    const store = createStoreStub([createNotification({ status: 'pending' })]);
    store.returnNullOnShownUpdate = true;
    store.nextFindByIdForUserRecords = [
      createNotification({ status: 'pending' }),
      createNotification({
        status: 'read',
        readAt: new Date('2026-06-18T02:00:00.000Z')
      })
    ];
    const service = new SystemNotificationService(store);

    const result = await service.markShown('notification-1', 'u-1');

    assert.equal(result.status, 'read');
    assert.equal(result.readAt, '2026-06-18T02:00:00.000Z');
    assert.equal(store.lastStatusUpdateArgs?.statusGuard, 'pending');
  });

  it('does not downgrade a read notification back to shown', async () => {
    const readNotification = createNotification({
      status: 'read',
      readAt: new Date('2026-06-18T02:00:00.000Z')
    });
    const store = createStoreStub([readNotification]);
    const service = new SystemNotificationService(store);

    const result = await service.markShown('notification-1', 'u-1');

    assert.equal(result.status, 'read');
    assert.equal(result.readAt, '2026-06-18T02:00:00.000Z');
    assert.equal(store.lastStatusUpdateArgs, null);
  });
});

function createNotification(overrides: Partial<SystemNotificationRecord> = {}): SystemNotificationRecord {
  return {
    id: 'notification-1',
    userId: 'u-1',
    userName: 'tester',
    module: 'ai-leads',
    type: 'task_finished',
    title: '采集任务已完成',
    content: 'AI 获客采集任务已完成',
    targetType: 'aiLeadSearchTask',
    targetId: 'task-1',
    routePath: '/ai-leads/search-tasks',
    status: 'pending',
    shownAt: null,
    readAt: null,
    metadata: null,
    createdAt: new Date('2026-06-18T01:00:00.000Z'),
    updatedAt: new Date('2026-06-18T01:00:00.000Z'),
    ...overrides
  };
}

function createStoreStub(records: SystemNotificationRecord[]) {
  const stub: SystemNotificationStore & {
    lastListArgs: SystemNotificationListArgs | null;
    lastCreateArgs: CreateSystemNotificationStoreInput | null;
    lastStatusUpdateArgs: SystemNotificationStatusUpdateArgs | null;
    lastTargetReadArgs: { targetType: string; targetId: string; userId: string } | null;
    returnNullOnShownUpdate: boolean;
    nextFindByIdForUserRecords: SystemNotificationRecord[];
  } = {
    lastListArgs: null as SystemNotificationListArgs | null,
    lastCreateArgs: null as CreateSystemNotificationStoreInput | null,
    lastStatusUpdateArgs: null as SystemNotificationStatusUpdateArgs | null,
    lastTargetReadArgs: null as { targetType: string; targetId: string; userId: string } | null,
    returnNullOnShownUpdate: false,
    nextFindByIdForUserRecords: [] as SystemNotificationRecord[],
    async create(input: CreateSystemNotificationStoreInput) {
      stub.lastCreateArgs = input;

      return createNotification(input);
    },
    async list(args: SystemNotificationListArgs) {
      stub.lastListArgs = args;

      return records;
    },
    async findByIdForUser(id: string, userId: string) {
      const nextRecord = stub.nextFindByIdForUserRecords.shift();

      if (nextRecord) {
        return nextRecord;
      }

      return records.find(record => record.id === id && record.userId === userId) ?? createNotification({ id, userId });
    },
    async updateStatus(args: SystemNotificationStatusUpdateArgs) {
      stub.lastStatusUpdateArgs = args;

      if (stub.returnNullOnShownUpdate && args.status === 'shown') {
        return null;
      }

      return createNotification(args);
    },
    async markTargetReadForUser(args) {
      stub.lastTargetReadArgs = {
        targetType: args.targetType,
        targetId: args.targetId,
        userId: args.userId
      };

      return { count: 2 };
    }
  };

  return stub;
}
