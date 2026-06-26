import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  crmPermissionCodes,
  getInvalidPermissionCodes,
  normalizePermissionCodes,
  type PermissionCode
} from '@soybean/shared';
import type { Prisma, SystemRole } from '../../generated/prisma/client';
import { createPageResult } from '../../shared/pagination';
import { SystemLogService } from '../system-log/system-log.service';
import { PrismaService } from '../database/prisma.service';
import type {
  SystemRoleListItem,
  SystemRoleOperateInput,
  SystemRoleSearchParams,
  SystemRoleStatus,
  SystemRoleUpdateInput
} from './system-role.types';

const defaultPage = 1;
const defaultPageSize = 10;
const maxPageSize = 100;
const superRoleCode = 'R_SUPER';

@Injectable()
export class SystemRoleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService
  ) {}

  /** Query platform roles with normalized pagination and filters. */
  async list(query: SystemRoleSearchParams) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const where = this.buildWhere(query);
    const [records, total] = await Promise.all([
      this.prisma.systemRole.findMany({
        where,
        skip: (current - 1) * size,
        take: size,
        orderBy: [{ builtIn: 'desc' }, { createdAt: 'asc' }]
      }),
      this.prisma.systemRole.count({ where })
    ]);

    return createPageResult({
      current,
      size,
      total,
      records: records.map(role => this.toListItem(role))
    });
  }

  /** Return all enabled roles for user assignment controls. */
  async listEnabled() {
    const records = await this.prisma.systemRole.findMany({
      where: { status: 'enabled' },
      orderBy: [{ builtIn: 'desc' }, { createdAt: 'asc' }]
    });

    return records.map(role => this.toListItem(role));
  }

  /** Create one role and bind its role-level permissions. */
  async create(input: SystemRoleOperateInput, operator: OperatorContext) {
    const roleName = input.roleName.trim();
    const roleCode = input.roleCode.trim().toUpperCase();
    assertRoleName(roleName);
    assertRoleCode(roleCode);
    await this.assertUniqueRoleCode(roleCode);

    const permissions =
      roleCode === superRoleCode ? [...crmPermissionCodes] : normalizeRolePermissions(input.permissions || []);
    const created = await this.prisma.systemRole.create({
      data: {
        roleName,
        roleCode,
        roleDesc: normalizeNullableString(input.roleDesc),
        permissions,
        status: input.status || 'enabled',
        builtIn: false
      }
    });

    await this.recordRoleLog('create', '创建角色', operator, created, {
      roleCode: created.roleCode,
      permissions: created.permissions
    });

    return this.toListItem(created);
  }

  /** Update editable role metadata. */
  async update(id: string, input: SystemRoleUpdateInput, operator: OperatorContext) {
    const role = await this.findByIdOrThrow(id);
    const roleName = input.roleName?.trim();

    if (roleName !== undefined) {
      assertRoleName(roleName);
    }

    if (role.roleCode === superRoleCode && input.status === 'disabled') {
      throw new ForbiddenException('不能禁用超级管理员角色');
    }

    const updated = await this.prisma.systemRole.update({
      where: { id },
      data: {
        ...(roleName ? { roleName } : {}),
        ...(input.roleDesc !== undefined ? { roleDesc: normalizeNullableString(input.roleDesc) } : {}),
        ...(input.status ? { status: input.status } : {})
      }
    });

    await this.recordRoleLog('update', '更新角色', operator, updated, {
      roleCode: updated.roleCode,
      changedFields: Object.keys(input)
    });

    return this.toListItem(updated);
  }

  /** Update role-level product permissions. */
  async updatePermissions(id: string, permissions: readonly string[], operator: OperatorContext) {
    const role = await this.findByIdOrThrow(id);

    if (role.roleCode === superRoleCode) {
      throw new ForbiddenException('超级管理员角色默认拥有全部权限');
    }

    const beforePermissions = normalizePermissionCodes(role.permissions);
    const nextPermissions = normalizeRolePermissions(permissions);
    const updated = await this.prisma.systemRole.update({
      where: { id },
      data: {
        permissions: nextPermissions
      }
    });

    await this.recordRoleLog('update-permissions', '更新角色权限', operator, updated, {
      roleCode: updated.roleCode,
      beforePermissions,
      afterPermissions: nextPermissions
    });

    return this.toListItem(updated);
  }

  private buildWhere(query: SystemRoleSearchParams): Prisma.SystemRoleWhereInput {
    const where: Prisma.SystemRoleWhereInput = {};
    const keyword = query.keyword?.trim();

    if (keyword) {
      where.OR = ['roleName', 'roleCode', 'roleDesc'].map(field => ({
        [field]: {
          contains: keyword,
          mode: 'insensitive'
        }
      }));
    }

    if (query.status) {
      where.status = query.status;
    }

    return where;
  }

  private async findByIdOrThrow(id: string) {
    const role = await this.prisma.systemRole.findUnique({
      where: { id }
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    return role;
  }

  private async assertUniqueRoleCode(roleCode: string, excludeId?: string) {
    const existing = await this.prisma.systemRole.findFirst({
      where: {
        roleCode: {
          equals: roleCode,
          mode: 'insensitive'
        },
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException('角色编码已存在');
    }
  }

  private toListItem(role: SystemRole): SystemRoleListItem {
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      roleDesc: role.roleDesc,
      permissions: normalizePermissionCodes(role.permissions) as PermissionCode[],
      status: role.status as SystemRoleStatus,
      builtIn: role.builtIn,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString()
    };
  }

  private recordRoleLog(
    action: string,
    message: string,
    operator: OperatorContext,
    target: SystemRole,
    metadata: Record<string, unknown>
  ) {
    return this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'system-role',
      action,
      message,
      userId: operator.userId,
      userName: operator.userName,
      metadata: {
        ...metadata,
        targetRoleId: target.id,
        targetRoleCode: target.roleCode,
        targetRoleName: target.roleName
      }
    });
  }
}

function normalizeRolePermissions(values: readonly string[]) {
  const invalidCodes = getInvalidPermissionCodes(values);

  if (invalidCodes.length) {
    throw new BadRequestException(`权限不存在：${invalidCodes.join('、')}`);
  }

  return normalizePermissionCodes(values);
}

function normalizePositiveInteger(value: number | string | undefined, defaultValue: number) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const numberValue = Number(value);

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : defaultValue;
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized || null;
}

function assertRoleName(value: string) {
  if (value.length < 2 || value.length > 50) {
    throw new BadRequestException('角色名称长度需为 2 到 50 个字符');
  }
}

function assertRoleCode(value: string) {
  if (!/^R_[A-Z0-9_]{2,40}$/.test(value)) {
    throw new BadRequestException('角色编码需以 R_ 开头，仅支持大写字母、数字和下划线');
  }
}

export interface OperatorContext {
  userId: string;
  userName: string;
  roles: string[];
}
