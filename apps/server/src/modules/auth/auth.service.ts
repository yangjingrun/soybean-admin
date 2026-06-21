import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { crmPermissionCodes, normalizePermissionCodes } from '@soybean/shared';
import * as svgCaptcha from 'svg-captcha';
import type { Organization, SystemUser } from '../../generated/prisma/client';
import { AppConfigService } from '../app-config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { ImageCaptchaResult, LoginToken, UserInfo } from './auth.types';
import { hashPassword, verifyPassword } from './password';

const captchaExpiresIn = 300;
const devAccessToken = 'dev_access_soybean';
const devRefreshToken = 'dev_refresh_soybean';
const devUserId = '4';
const maxFailedLoginCount = 5;
const lockDurationMs = 15 * 60 * 1000;
const defaultAccessTokenTtlSeconds = 7200;
const defaultRefreshTokenTtlSeconds = 1209600;

@Injectable()
export class AuthService {
  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(AppConfigService) private readonly appConfigService?: AppConfigService
  ) {}

  /** Validate captcha and database credentials, then issue frontend-compatible tokens. */
  async login(
    userName: string,
    password: string,
    captchaId?: string,
    captchaCode?: string,
    loginIp?: string,
    userAgent?: string
  ): Promise<LoginToken | null> {
    const captchaPassed = this.isDevAuth() || (await this.verifyCaptcha(captchaId, captchaCode));

    if (!captchaPassed) {
      return null;
    }

    const user = await this.findUserByUserName(userName);

    if (!user || !this.isUserEnabled(user) || this.isUserExpired(user) || this.isUserLocked(user)) {
      return null;
    }

    const passwordPassed = await verifyPassword(password, user.passwordSalt, user.passwordHash);

    if (!passwordPassed) {
      await this.recordFailedLogin(user);
      return null;
    }

    await this.prisma.systemUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        ...(loginIp ? { lastLoginIp: loginIp } : {})
      }
    });

    return this.issueTokens(await this.toUserInfo(user), loginIp, userAgent);
  }

  /** Create a short-lived image captcha for password login. */
  async createCaptcha(): Promise<ImageCaptchaResult> {
    const captcha = svgCaptcha.create({
      size: 6,
      noise: 3,
      color: true,
      charPreset: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    });
    const captchaId = randomUUID();

    await this.redisService
      .getClient()
      .set(this.getCaptchaKey(captchaId), captcha.text.toLowerCase(), 'EX', captchaExpiresIn);

    return {
      captchaId,
      svg: captcha.data,
      expiresIn: captchaExpiresIn
    };
  }

  private async verifyCaptcha(captchaId?: string, captchaCode?: string) {
    if (!captchaId || !captchaCode) {
      return false;
    }

    const key = this.getCaptchaKey(captchaId);
    const code = await this.redisService.getClient().get(key);

    if (!code) {
      return false;
    }

    await this.redisService.getClient().del(key);

    return code === captchaCode.trim().toLowerCase();
  }

  private getCaptchaKey(captchaId: string) {
    return `auth:captcha:${captchaId}`;
  }

  /** Resolve the current user from the Authorization header token. */
  async getUserByAccessToken(token: string): Promise<UserInfo | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        accessTokenHash: this.hashToken(token),
        revokedAt: null
      },
      include: {
        user: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!session || session.accessTokenExpiresAt.getTime() <= Date.now()) {
      return null;
    }

    const user = await this.toUserInfo(session.user);

    if (!user || this.isSnapshotExpired(user) || this.isSnapshotLocked(user) || user.status !== 'enabled') {
      return null;
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      userId: user.userId,
      userName: user.userName,
      roles: user.roles,
      buttons: user.buttons,
      organizationId: user.organizationId,
      organizationName: user.organizationName,
      organizationRole: user.organizationRole
    };
  }

  /** Rotate access and refresh tokens from an existing refresh token. */
  async refresh(refreshToken: string): Promise<LoginToken | null> {
    if (!refreshToken) {
      return null;
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        refreshTokenHash: this.hashToken(refreshToken),
        revokedAt: null
      },
      include: {
        user: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!session || session.refreshTokenExpiresAt.getTime() <= Date.now()) {
      return null;
    }

    const user = await this.toUserInfo(session.user);

    if (this.isSnapshotExpired(user) || this.isSnapshotLocked(user) || user.status !== 'enabled') {
      return null;
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    return this.issueTokens(user, session.loginIp || undefined, session.userAgent || undefined);
  }

  /** Revoke tokens for an explicit logout action. */
  async logout(token: string) {
    if (!token) {
      return;
    }

    await this.prisma.authSession.updateMany({
      where: {
        accessTokenHash: this.hashToken(token),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  /** Revoke every issued token for one user. */
  async revokeUserTokens(userId: string) {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  /** Change current user's password after verifying the old password. */
  async changePassword(userId: string, oldPassword: string, newPassword: string, currentAccessToken: string) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const oldPasswordPassed = await verifyPassword(oldPassword, user.passwordSalt, user.passwordHash);

    if (!oldPasswordPassed) {
      throw new BadRequestException('原密码错误');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }

    const password = await hashPassword(newPassword);
    await this.prisma.systemUser.update({
      where: { id: userId },
      data: {
        passwordHash: password.hash,
        passwordSalt: password.salt,
        passwordResetAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      }
    });

    // Keep the current session usable; revoke old sessions on other devices.
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        accessTokenHash: {
          not: this.hashToken(currentAccessToken)
        }
      },
      data: { revokedAt: new Date() }
    });
  }

  private async issueTokens(user: UserInfoWithSession, loginIp?: string, userAgent?: string): Promise<LoginToken> {
    const useDevFixedToken = this.isDevAuth() && user.userId === devUserId;
    const token = useDevFixedToken ? devAccessToken : `access_${randomUUID()}`;
    const refreshToken = useDevFixedToken ? devRefreshToken : `refresh_${randomUUID()}`;
    const now = new Date();
    const accessTokenHash = this.hashToken(token);
    const refreshTokenHash = this.hashToken(refreshToken);

    if (useDevFixedToken) {
      await this.revokeUserTokens(user.userId);
    }

    await this.persistIssuedSession(
      {
        userId: user.userId,
        accessTokenHash,
        refreshTokenHash,
        accessTokenExpiresAt: new Date(now.getTime() + this.getAccessTokenTtlMs()),
        refreshTokenExpiresAt: new Date(now.getTime() + this.getRefreshTokenTtlMs()),
        revokedAt: null,
        loginIp: loginIp || null,
        userAgent: userAgent || null,
        lastUsedAt: now
      },
      useDevFixedToken
    );

    return {
      token,
      refreshToken
    };
  }

  /** Persist a new session, reusing the fixed development token row when dev login repeats. */
  private async persistIssuedSession(data: AuthSessionWriteData, reuseFixedTokenSession: boolean) {
    if (reuseFixedTokenSession) {
      await this.prisma.authSession.upsert({
        where: {
          accessTokenHash: data.accessTokenHash
        },
        update: data,
        create: data
      });

      return;
    }

    await this.prisma.authSession.create({
      data: {
        ...data
      }
    });
  }

  private async findUserByUserName(userName: string) {
    const trimUserName = userName.trim();

    if (!trimUserName) {
      return null;
    }

    return this.prisma.systemUser.findFirst({
      where: {
        userName: {
          equals: trimUserName,
          mode: 'insensitive'
        }
      },
      include: {
        organization: true
      }
    });
  }

  private async recordFailedLogin(user: SystemUser) {
    const now = new Date();
    const shouldResetExpiredLock = user.lockedUntil && user.lockedUntil.getTime() <= now.getTime();
    const failedLoginCount = shouldResetExpiredLock ? 1 : user.failedLoginCount + 1;
    const lockedUntil = failedLoginCount >= maxFailedLoginCount ? new Date(now.getTime() + lockDurationMs) : null;

    await this.prisma.systemUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil
      }
    });
  }

  private async toUserInfo(user: AuthSystemUser): Promise<UserInfoWithSession> {
    return {
      userId: user.id,
      userName: user.userName,
      roles: user.roles,
      buttons: await this.resolveRolePermissions(user.roles),
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationRole: user.organizationRole as UserInfo['organizationRole'],
      status: user.status,
      expireAt: user.expireAt?.toISOString() || null,
      lockedUntil: user.lockedUntil?.toISOString() || null
    };
  }

  private isUserEnabled(user: SystemUser) {
    return user.status === 'enabled';
  }

  private isUserExpired(user: SystemUser) {
    return Boolean(user.expireAt && user.expireAt.getTime() <= Date.now());
  }

  private isUserLocked(user: SystemUser) {
    return Boolean(user.lockedUntil && user.lockedUntil.getTime() > Date.now());
  }

  private async resolveRolePermissions(roles: readonly string[]) {
    if (roles.includes('R_SUPER')) {
      return [...crmPermissionCodes];
    }

    const roleRecords = await this.prisma.systemRole.findMany({
      where: {
        roleCode: { in: [...roles] },
        status: 'enabled'
      },
      select: {
        permissions: true
      }
    });

    return normalizePermissionCodes(roleRecords.flatMap(role => role.permissions));
  }

  private isSnapshotExpired(user: UserInfoWithSession) {
    return Boolean(user.expireAt && new Date(user.expireAt).getTime() <= Date.now());
  }

  private isSnapshotLocked(user: UserInfoWithSession) {
    return Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getAccessTokenTtlMs() {
    return (this.appConfigService?.config.authAccessTokenTtlSeconds || defaultAccessTokenTtlSeconds) * 1000;
  }

  private getRefreshTokenTtlMs() {
    return (this.appConfigService?.config.authRefreshTokenTtlSeconds || defaultRefreshTokenTtlSeconds) * 1000;
  }

  private isDevAuth() {
    return this.appConfigService?.config.authDevFixedTokenEnabled ?? process.env.NODE_ENV !== 'production';
  }
}

type AuthSystemUser = SystemUser & {
  organization: Pick<Organization, 'id' | 'name'>;
};

interface UserInfoWithSession extends UserInfo {
  status: string;
  expireAt: string | null;
  lockedUntil: string | null;
}

interface AuthSessionWriteData {
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  revokedAt: Date | null;
  loginIp: string | null;
  userAgent: string | null;
  lastUsedAt: Date;
}
