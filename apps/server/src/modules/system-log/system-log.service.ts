import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createPageResult } from '../../shared/pagination';
import { SYSTEM_LOG_STORE } from './system-log.tokens';
import { sanitizeSystemLogInput } from './system-log-sanitizer';
import type {
  SystemLogListInput,
  SystemLogRecord,
  SystemLogRecordInput,
  SystemLogStore,
  SystemLogView,
  SystemLogWhereInput
} from './system-log.types';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

@Injectable()
export class SystemLogService {
  constructor(@Inject(SYSTEM_LOG_STORE) private readonly store: SystemLogStore) {}

  /** Query system logs with business filters and normalized pagination. */
  async list(query: SystemLogListInput) {
    const current = this.toPositiveInt(query.current, defaultPage);
    const size = Math.min(this.toPositiveInt(query.size, defaultPageSize), maxPageSize);
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

    return createPageResult({
      current,
      size,
      total,
      records: records.map(record => this.toView(record))
    });
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
    return this.store.create(sanitizeSystemLogInput(input));
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

  /** Normalize HTTP query numbers before passing them into Prisma pagination. */
  private toPositiveInt(value: number | string | undefined, fallback: number) {
    if (value === undefined || value === '') {
      return fallback;
    }

    const numberValue = Number(value);

    return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
  }
}
