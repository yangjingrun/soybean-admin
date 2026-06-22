import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Organization, Prisma } from '../../generated/prisma/client';
import { createPageResult } from '../../shared/pagination';
import { PrismaService } from '../database/prisma.service';
import { SystemLogService } from '../system-log/system-log.service';
import type {
  SystemOrganizationListItem,
  SystemOrganizationOperateInput,
  SystemOrganizationSearchParams,
  SystemOrganizationStatus,
  SystemOrganizationUpdateInput
} from './system-organization.types';

const defaultPage = 1;
const defaultPageSize = 10;
const maxPageSize = 100;

@Injectable()
export class SystemOrganizationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService
  ) {}

  /** Query organizations with normalized pagination, filters and user counters. */
  async list(query: SystemOrganizationSearchParams) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const where = this.buildWhere(query);
    const [records, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: (current - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.organization.count({ where })
    ]);
    const counters = await this.countOrganizationUsers(records.map(record => record.id));

    return createPageResult({
      current,
      size,
      total,
      records: records.map(record => this.toListItem(record, counters))
    });
  }

  /** Return enabled organizations for assignment controls. */
  async listEnabled() {
    const records = await this.prisma.organization.findMany({
      where: { status: 'enabled' },
      orderBy: { name: 'asc' }
    });

    return records.map(record => ({
      id: record.id,
      name: record.name
    }));
  }

  /** Create one organization after normalizing and de-duplicating its name. */
  async create(input: SystemOrganizationOperateInput, operator: OperatorContext) {
    const name = normalizeOrganizationName(input.name);
    await this.assertUniqueName(name);
    const organization = await this.prisma.organization.create({
      data: {
        name,
        status: input.status || 'enabled'
      }
    });

    await this.recordOrganizationLog('create', '创建组织', operator, organization, {
      targetOrganizationId: organization.id,
      targetOrganizationName: organization.name,
      status: organization.status
    });

    return this.toListItem(organization);
  }

  /** Update editable organization metadata. */
  async update(id: string, input: SystemOrganizationUpdateInput, operator: OperatorContext) {
    await this.findByIdOrThrow(id);
    const data: Prisma.OrganizationUpdateInput = {};

    if (input.name !== undefined) {
      const name = normalizeOrganizationName(input.name);
      await this.assertUniqueName(name, id);
      data.name = name;
    }

    if (input.status) {
      data.status = input.status;
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data
    });

    await this.recordOrganizationLog('update', '更新组织', operator, updated, {
      targetOrganizationId: updated.id,
      targetOrganizationName: updated.name,
      changedFields: Object.keys(input)
    });

    return this.toListItem(updated);
  }

  /** Enable or disable one organization without deleting its related business data. */
  async updateStatus(id: string, status: SystemOrganizationStatus, operator: OperatorContext) {
    await this.findByIdOrThrow(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status }
    });

    await this.recordOrganizationLog(
      status === 'enabled' ? 'enable' : 'disable',
      status === 'enabled' ? '启用组织' : '禁用组织',
      operator,
      updated,
      {
        targetOrganizationId: updated.id,
        targetOrganizationName: updated.name,
        status
      }
    );

    return this.toListItem(updated);
  }

  private buildWhere(query: SystemOrganizationSearchParams): Prisma.OrganizationWhereInput {
    const where: Prisma.OrganizationWhereInput = {};
    const keyword = query.keyword?.trim();

    if (keyword) {
      where.name = {
        contains: keyword,
        mode: 'insensitive'
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    return where;
  }

  private async countOrganizationUsers(organizationIds: string[]) {
    if (!organizationIds.length) {
      return {
        userCounts: new Map<string, number>(),
        adminCounts: new Map<string, number>()
      };
    }

    const [userGroups, adminGroups] = await Promise.all([
      this.prisma.systemUser.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: organizationIds } },
        _count: { _all: true }
      }),
      this.prisma.systemUser.groupBy({
        by: ['organizationId'],
        where: {
          organizationId: { in: organizationIds },
          organizationRole: 'admin'
        },
        _count: { _all: true }
      })
    ]);

    return {
      userCounts: toCountMap(userGroups),
      adminCounts: toCountMap(adminGroups)
    };
  }

  private async findByIdOrThrow(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      throw new NotFoundException('组织不存在');
    }

    return organization;
  }

  private async assertUniqueName(name: string, excludeId?: string) {
    const existing = await this.prisma.organization.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        },
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException('组织名称已存在');
    }
  }

  private toListItem(
    organization: Organization,
    counters: OrganizationCounters = {
      userCounts: new Map<string, number>(),
      adminCounts: new Map<string, number>()
    }
  ): SystemOrganizationListItem {
    return {
      id: organization.id,
      name: organization.name,
      status: organization.status as SystemOrganizationStatus,
      userCount: counters.userCounts.get(organization.id) || 0,
      adminCount: counters.adminCounts.get(organization.id) || 0,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  private recordOrganizationLog(
    action: string,
    message: string,
    operator: OperatorContext,
    target: Organization,
    metadata: Record<string, unknown>
  ) {
    return this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'system-organization',
      action,
      message,
      userId: operator.userId,
      userName: operator.userName,
      metadata: {
        ...metadata,
        targetOrganizationId: target.id,
        targetOrganizationName: target.name
      }
    });
  }
}

function normalizePositiveInteger(value: number | string | undefined, fallback: number) {
  const numberValue = Number(value);

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeOrganizationName(value: string) {
  const name = value.trim();

  if (!name) {
    throw new BadRequestException('组织名称不能为空');
  }

  return name;
}

function toCountMap(groups: Array<{ organizationId: string; _count: { _all: number } }>) {
  return new Map(
    groups.map(group => {
      const { organizationId, _count: count } = group;
      const { _all: total } = count;

      return [organizationId, total] as const;
    })
  );
}

interface OrganizationCounters {
  userCounts: Map<string, number>;
  adminCounts: Map<string, number>;
}

export interface OperatorContext {
  userId: string;
  userName: string;
  roles: string[];
}
