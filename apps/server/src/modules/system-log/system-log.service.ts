import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SYSTEM_LOG_STORE } from './system-log.tokens';
import type {
  SystemLogListInput,
  SystemLogRecord,
  SystemLogRecordInput,
  SystemLogStore,
  SystemLogView,
  SystemLogWhereInput
} from './system-log.types';

const secretKeys = new Set(['apikey', 'api_key', 'token', 'password']);

@Injectable()
export class SystemLogService {
  constructor(@Inject(SYSTEM_LOG_STORE) private readonly store: SystemLogStore) {}

  /** Query system logs with business filters and normalized pagination. */
  async list(query: SystemLogListInput) {
    const current = query.current ?? 1;
    const size = query.size ?? 20;
    const where = this.toWhere(query);
    const [records, total] = await Promise.all([
      this.store.list({
        where,
        skip: (current - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' }
      }),
      this.store.count(where)
    ]);

    return {
      current,
      size,
      total,
      records: records.map(record => this.toView(record))
    };
  }

  /** Read one log detail by id. */
  async getById(id: string) {
    const record = await this.store.findById(id);

    if (!record) {
      throw new NotFoundException('日志不存在');
    }

    return this.toView(record);
  }

  /** Return users that have produced backend logs. */
  listUsers() {
    return this.store.listUsers();
  }

  /** Business entry for writing backend logs. */
  async record(input: SystemLogRecordInput) {
    return this.store.create({
      ...input,
      metadata: this.sanitizeMetadata(input.metadata)
    });
  }

  private toWhere(query: SystemLogListInput): SystemLogWhereInput {
    const where: SystemLogWhereInput = {};

    if (query.level) where.level = query.level;
    if (query.status) where.status = query.status;
    if (query.module) where.module = query.module;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.userName) where.userName = query.userName;

    if (query.startTime || query.endTime) {
      where.createdAt = {};
      if (query.startTime) where.createdAt.gte = new Date(query.startTime);
      if (query.endTime) where.createdAt.lte = new Date(query.endTime);
    }

    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = ['message', 'action', 'module', 'userName', 'errorMessage'].map(field => ({
        [field]: {
          contains: keyword,
          mode: 'insensitive'
        }
      }));
    }

    return where;
  }

  private toView(record: SystemLogRecord): SystemLogView {
    return {
      ...record,
      createdAt: record.createdAt.toISOString()
    };
  }

  private sanitizeMetadata(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeMetadata(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !secretKeys.has(key.toLowerCase()))
        .map(([key, item]) => [key, this.sanitizeMetadata(item)])
    );
  }
}
