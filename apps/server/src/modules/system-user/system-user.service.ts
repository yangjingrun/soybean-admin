import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { DEFAULT_ORGANIZATION_ID, type OrganizationRole } from '@soybean/shared';
import type { Organization, Prisma, SystemUser } from '../../generated/prisma/client';
import { hashPassword, generateTemporaryPassword } from '../auth/password';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { SystemLogService } from '../system-log/system-log.service';
import type {
  SystemUserListItem,
  SystemUserOperateInput,
  SystemUserRole,
  SystemUserSearchParams,
  SystemUserStatus,
  SystemUserUpdateInput
} from './system-user.types';

const defaultPage = 1;
const defaultPageSize = 10;
const maxPageSize = 100;
const superRole: SystemUserRole = 'R_SUPER';

@Injectable()
export class SystemUserService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService
  ) {}

  /** Query system users with normalized pagination and filters. */
  async list(query: SystemUserSearchParams) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const where = this.buildWhere(query);
    const [records, total] = await Promise.all([
      this.prisma.systemUser.findMany({
        where,
        skip: (current - 1) * size,
        take: size,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: true
        }
      }),
      this.prisma.systemUser.count({ where })
    ]);

    return {
      current,
      size,
      total,
      records: records.map(user => this.toListItem(user))
    };
  }

  /** Create one user and return a one-time temporary password. */
  async create(input: SystemUserOperateInput, operator: OperatorContext) {
    const userName = input.userName.trim();
    assertUserName(userName);
    this.assertRoles(input.roles);
    await this.assertUniqueUserName(userName);

    const temporaryPassword = generateTemporaryPassword();
    const password = await hashPassword(temporaryPassword);
    const user = await this.prisma.systemUser.create({
      data: {
        userName,
        nickName: normalizeNullableString(input.nickName),
        phone: normalizeNullableString(input.phone),
        email: normalizeNullableString(input.email),
        roles: input.roles,
        status: input.status || 'enabled',
        organizationId: DEFAULT_ORGANIZATION_ID,
        organizationRole: resolveOrganizationRole(input.roles),
        companyName: normalizeNullableString(input.companyName),
        expireAt: toNullableDate(input.expireAt),
        remark: normalizeNullableString(input.remark),
        passwordHash: password.hash,
        passwordSalt: password.salt
      },
      include: {
        organization: true
      }
    });

    await this.recordUserLog('create', '创建用户', operator, user, {
      targetUserId: user.id,
      targetUserName: user.userName,
      roles: user.roles,
      status: user.status
    });

    return {
      user: this.toListItem(user),
      temporaryPassword
    };
  }

  /** Update editable user profile and role fields. */
  async update(id: string, input: SystemUserUpdateInput, operator: OperatorContext) {
    const user = await this.findByIdOrThrow(id);
    const nextRoles = input.roles ?? (user.roles as SystemUserRole[]);
    const nextStatus = input.status ?? (user.status as SystemUserStatus);
    const nextExpireAt = input.expireAt !== undefined ? toNullableDate(input.expireAt) : user.expireAt;

    if (input.roles) {
      this.assertRoles(input.roles);
    }

    if (nextStatus === 'disabled') {
      this.assertNotSelf(operator, user);
    }

    this.assertSelfSuperRole(operator, user, nextRoles);
    await this.assertAnotherActiveSuperIfNeeded(user, nextRoles, nextStatus, nextExpireAt);

    const userName = input.userName?.trim();
    if (input.userName !== undefined) {
      assertUserName(userName || '');
    }

    if (userName && userName !== user.userName) {
      await this.assertUniqueUserName(userName, id);
    }

    const updated = await this.prisma.systemUser.update({
      where: { id },
      data: {
        ...(userName ? { userName } : {}),
        ...(input.nickName !== undefined ? { nickName: normalizeNullableString(input.nickName) } : {}),
        ...(input.phone !== undefined ? { phone: normalizeNullableString(input.phone) } : {}),
        ...(input.email !== undefined ? { email: normalizeNullableString(input.email) } : {}),
        ...(input.roles ? { roles: input.roles, organizationRole: resolveOrganizationRole(input.roles) } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.companyName !== undefined ? { companyName: normalizeNullableString(input.companyName) } : {}),
        ...(input.expireAt !== undefined ? { expireAt: toNullableDate(input.expireAt) } : {}),
        ...(input.remark !== undefined ? { remark: normalizeNullableString(input.remark) } : {})
      },
      include: {
        organization: true
      }
    });

    if (input.status === 'disabled') {
      this.authService.revokeUserTokens(id);
    }

    await this.recordUserLog('update', '更新用户', operator, updated, {
      targetUserId: updated.id,
      targetUserName: updated.userName,
      changedFields: Object.keys(input)
    });

    return this.toListItem(updated);
  }

  /** Enable or disable one user. */
  async updateStatus(id: string, status: SystemUserStatus, operator: OperatorContext) {
    const user = await this.findByIdOrThrow(id);

    if (status === 'disabled') {
      this.assertNotSelf(operator, user);
      await this.assertAnotherActiveSuperIfNeeded(user, user.roles as SystemUserRole[], status, user.expireAt);
    }

    const updated = await this.prisma.systemUser.update({
      where: { id },
      data: { status },
      include: {
        organization: true
      }
    });

    if (status === 'disabled') {
      this.authService.revokeUserTokens(id);
    }

    await this.recordUserLog(
      status === 'enabled' ? 'enable' : 'disable',
      status === 'enabled' ? '启用用户' : '禁用用户',
      operator,
      updated,
      {
        targetUserId: updated.id,
        targetUserName: updated.userName,
        status
      }
    );

    return this.toListItem(updated);
  }

  /** Reset one user password and return a one-time temporary password. */
  async resetPassword(id: string, operator: OperatorContext) {
    await this.findByIdOrThrow(id);
    const temporaryPassword = generateTemporaryPassword();
    const password = await hashPassword(temporaryPassword);
    const updated = await this.prisma.systemUser.update({
      where: { id },
      data: {
        passwordHash: password.hash,
        passwordSalt: password.salt,
        passwordResetAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      },
      include: {
        organization: true
      }
    });

    this.authService.revokeUserTokens(id);

    await this.recordUserLog('reset-password', '重置用户密码', operator, updated, {
      targetUserId: updated.id,
      targetUserName: updated.userName
    });

    return {
      user: this.toListItem(updated),
      temporaryPassword
    };
  }

  private buildWhere(query: SystemUserSearchParams): Prisma.SystemUserWhereInput {
    const where: Prisma.SystemUserWhereInput = {};
    const andConditions: Prisma.SystemUserWhereInput[] = [];
    const keyword = query.keyword?.trim();
    const now = new Date();

    if (keyword) {
      andConditions.push({
        OR: ['userName', 'nickName', 'phone', 'email', 'companyName'].map(field => ({
          [field]: {
            contains: keyword,
            mode: 'insensitive'
          }
        }))
      });
    }

    if (query.role) {
      where.roles = { has: query.role };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.expirationStatus === 'expired') {
      where.expireAt = { lte: now };
    }

    if (query.expirationStatus === 'active') {
      andConditions.push({
        OR: [{ expireAt: null }, { expireAt: { gt: now } }]
      });
    }

    if (andConditions.length) {
      where.AND = andConditions;
    }

    return where;
  }

  private async findByIdOrThrow(id: string) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id },
      include: {
        organization: true
      }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  private async assertUniqueUserName(userName: string, excludeId?: string) {
    const existing = await this.prisma.systemUser.findFirst({
      where: {
        userName: {
          equals: userName,
          mode: 'insensitive'
        },
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException('用户名已存在');
    }
  }

  private assertRoles(roles: SystemUserRole[]) {
    if (!roles.length) {
      throw new BadRequestException('请至少选择一个角色');
    }
  }

  private assertNotSelf(operator: OperatorContext, user: SystemUser) {
    if (operator.userId === user.id) {
      throw new ForbiddenException('不能禁用当前登录用户');
    }
  }

  private assertSelfSuperRole(operator: OperatorContext, user: SystemUser, nextRoles: SystemUserRole[]) {
    if (operator.userId === user.id && user.roles.includes(superRole) && !nextRoles.includes(superRole)) {
      throw new ForbiddenException('不能移除自己的超级管理员角色');
    }
  }

  private async assertAnotherActiveSuperIfNeeded(
    user: SystemUser,
    nextRoles: SystemUserRole[],
    nextStatus: string,
    nextExpireAt: Date | null
  ) {
    const willRemainActiveSuper =
      nextStatus === 'enabled' &&
      nextRoles.includes(superRole) &&
      (!nextExpireAt || nextExpireAt.getTime() > Date.now());

    if (willRemainActiveSuper) {
      return;
    }

    if (!user.roles.includes(superRole)) {
      return;
    }

    const activeSuperCount = await this.prisma.systemUser.count({
      where: {
        id: { not: user.id },
        status: 'enabled',
        roles: { has: superRole },
        OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }]
      }
    });

    if (activeSuperCount <= 0) {
      throw new ForbiddenException('系统至少需要保留一个可用的超级管理员');
    }
  }

  private toListItem(user: SystemUserWithOrganization): SystemUserListItem {
    const now = Date.now();
    const expired = Boolean(user.expireAt && user.expireAt.getTime() <= now);
    const locked = Boolean(user.lockedUntil && user.lockedUntil.getTime() > now);

    return {
      id: user.id,
      userName: user.userName,
      nickName: user.nickName,
      phone: user.phone,
      email: user.email,
      roles: user.roles as SystemUserRole[],
      status: user.status as SystemUserStatus,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationRole: user.organizationRole as OrganizationRole,
      companyName: user.companyName,
      expireAt: user.expireAt?.toISOString() || null,
      remark: user.remark,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      lastLoginIp: user.lastLoginIp,
      lockedUntil: user.lockedUntil?.toISOString() || null,
      expired,
      locked,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private recordUserLog(
    action: string,
    message: string,
    operator: OperatorContext,
    target: SystemUser,
    metadata: Record<string, unknown>
  ) {
    return this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'system-user',
      action,
      message,
      userId: operator.userId,
      userName: operator.userName,
      metadata: {
        ...metadata,
        targetUserId: target.id,
        targetUserName: target.userName
      }
    });
  }
}

type SystemUserWithOrganization = SystemUser & {
  organization: Pick<Organization, 'id' | 'name'>;
};

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

function assertUserName(value: string) {
  if (value.length < 2 || value.length > 50) {
    throw new BadRequestException('用户名长度需为 2 到 50 个字符');
  }
}

function toNullableDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

/** Map platform roles to the first-version organization role. */
function resolveOrganizationRole(roles: SystemUserRole[]): OrganizationRole {
  return roles.includes('R_SUPER') || roles.includes('R_ADMIN') ? 'admin' : 'member';
}

export interface OperatorContext {
  userId: string;
  userName: string;
  roles: string[];
}
