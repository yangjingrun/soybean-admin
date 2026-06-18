import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as svgCaptcha from 'svg-captcha';
import type { Organization, SystemUser } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { ImageCaptchaResult, LoginToken, UserInfo } from './auth.types';
import { verifyPassword } from './password';

const captchaExpiresIn = 300;
const devAccessToken = 'dev_access_soybean';
const devRefreshToken = 'dev_refresh_soybean';
const devUserId = '4';
const maxFailedLoginCount = 5;
const lockDurationMs = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly accessTokens = new Map<string, UserInfoWithSession>();
  private readonly refreshTokens = new Map<string, UserInfoWithSession>();
  private readonly userAccessTokens = new Map<string, Set<string>>();
  private readonly userRefreshTokens = new Map<string, Set<string>>();

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  /** Validate captcha and database credentials, then issue frontend-compatible tokens. */
  async login(
    userName: string,
    password: string,
    captchaId?: string,
    captchaCode?: string,
    loginIp?: string
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

    return this.issueTokens(this.toUserInfo(user));
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
  getUserByAccessToken(token: string): UserInfo | null {
    const user = this.accessTokens.get(token);

    if (!user || this.isSnapshotExpired(user) || this.isSnapshotLocked(user) || user.status !== 'enabled') {
      return null;
    }

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
  refresh(refreshToken: string): LoginToken | null {
    if (this.isDevAuth() && refreshToken === devRefreshToken) {
      const user = this.accessTokens.get(devAccessToken);
      return user ? this.issueTokens(user) : null;
    }

    const user = this.refreshTokens.get(refreshToken);

    if (!user || this.isSnapshotExpired(user) || this.isSnapshotLocked(user) || user.status !== 'enabled') {
      return null;
    }

    this.deleteRefreshToken(refreshToken);

    return this.issueTokens(user);
  }

  /** Revoke tokens for an explicit logout action. */
  logout(token: string) {
    if (this.isDevAuth() && token === devAccessToken) {
      this.revokeUserTokens(devUserId);
      return;
    }

    const user = this.accessTokens.get(token);

    if (!user) {
      return;
    }

    this.deleteAccessToken(token);
    this.clearRefreshTokens(user.userId);
  }

  /** Revoke every issued token for one user. */
  revokeUserTokens(userId: string) {
    this.clearAccessTokens(userId);
    this.clearRefreshTokens(userId);
  }

  private issueTokens(user: UserInfoWithSession): LoginToken {
    if (this.isDevAuth() && user.userId === devUserId) {
      this.accessTokens.set(devAccessToken, user);
      this.refreshTokens.set(devRefreshToken, user);
      this.trackAccessToken(user.userId, devAccessToken);
      this.trackRefreshToken(user.userId, devRefreshToken);

      return {
        token: devAccessToken,
        refreshToken: devRefreshToken
      };
    }

    const token = `access_${randomUUID()}`;
    const refreshToken = `refresh_${randomUUID()}`;

    this.accessTokens.set(token, user);
    this.refreshTokens.set(refreshToken, user);
    this.trackAccessToken(user.userId, token);
    this.trackRefreshToken(user.userId, refreshToken);

    return {
      token,
      refreshToken
    };
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

  private toUserInfo(user: AuthSystemUser): UserInfoWithSession {
    return {
      userId: user.id,
      userName: user.userName,
      roles: user.roles,
      buttons: getButtonsByRoles(user.roles),
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

  private isSnapshotExpired(user: UserInfoWithSession) {
    return Boolean(user.expireAt && new Date(user.expireAt).getTime() <= Date.now());
  }

  private isSnapshotLocked(user: UserInfoWithSession) {
    return Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
  }

  private trackAccessToken(userId: string, token: string) {
    const tokens = this.userAccessTokens.get(userId) || new Set<string>();
    tokens.add(token);
    this.userAccessTokens.set(userId, tokens);
  }

  private trackRefreshToken(userId: string, token: string) {
    const tokens = this.userRefreshTokens.get(userId) || new Set<string>();
    tokens.add(token);
    this.userRefreshTokens.set(userId, tokens);
  }

  private clearAccessTokens(userId: string) {
    const tokens = this.userAccessTokens.get(userId);

    if (!tokens) {
      return;
    }

    tokens.forEach(token => this.accessTokens.delete(token));
    this.userAccessTokens.delete(userId);
  }

  private clearRefreshTokens(userId: string) {
    const tokens = this.userRefreshTokens.get(userId);

    if (!tokens) {
      return;
    }

    tokens.forEach(token => this.refreshTokens.delete(token));
    this.userRefreshTokens.delete(userId);
  }

  private deleteAccessToken(token: string) {
    const user = this.accessTokens.get(token);
    this.accessTokens.delete(token);

    if (user) {
      this.userAccessTokens.get(user.userId)?.delete(token);
    }
  }

  private deleteRefreshToken(token: string) {
    const user = this.refreshTokens.get(token);
    this.refreshTokens.delete(token);

    if (user) {
      this.userRefreshTokens.get(user.userId)?.delete(token);
    }
  }

  private isDevAuth() {
    return process.env.NODE_ENV !== 'production';
  }
}

type AuthSystemUser = SystemUser & {
  organization: Pick<Organization, 'id' | 'name'>;
};

function getButtonsByRoles(roles: string[]) {
  if (roles.includes('R_SUPER')) {
    return ['B_CODE1', 'B_CODE2', 'B_CODE3'];
  }

  if (roles.includes('R_ADMIN')) {
    return ['B_CODE1', 'B_CODE2'];
  }

  return ['B_CODE1'];
}

interface UserInfoWithSession extends UserInfo {
  status: string;
  expireAt: string | null;
  lockedUntil: string | null;
}
