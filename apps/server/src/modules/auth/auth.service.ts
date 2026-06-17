import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as svgCaptcha from 'svg-captcha';
import { RedisService } from '../redis/redis.service';
import type { DemoUser, ImageCaptchaResult, LoginToken, UserInfo } from './auth.types';

const demoUsers: DemoUser[] = [
  {
    userId: '1',
    userName: 'Super',
    password: '123456',
    roles: ['R_SUPER'],
    buttons: ['B_CODE1', 'B_CODE2', 'B_CODE3']
  },
  {
    userId: '2',
    userName: 'Admin',
    password: '123456',
    roles: ['R_ADMIN'],
    buttons: ['B_CODE1', 'B_CODE2']
  },
  {
    userId: '3',
    userName: 'User',
    password: '123456',
    roles: ['R_USER'],
    buttons: ['B_CODE1']
  },
  {
    userId: '4',
    userName: 'Soybean',
    password: '123456',
    roles: ['R_SUPER'],
    buttons: ['B_CODE1', 'B_CODE2', 'B_CODE3']
  }
];

const captchaExpiresIn = 300;
const devAccessToken = 'dev_access_soybean';
const devRefreshToken = 'dev_refresh_soybean';
const devUserId = '4';

@Injectable()
export class AuthService {
  private readonly accessTokens = new Map<string, string>();
  private readonly refreshTokens = new Map<string, string>();

  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  /** Validate captcha and demo credentials, then issue frontend-compatible tokens. */
  async login(userName: string, password: string, captchaId?: string, captchaCode?: string): Promise<LoginToken | null> {
    const captchaPassed = this.isDevAuth() || (await this.verifyCaptcha(captchaId, captchaCode));

    if (!captchaPassed) {
      return null;
    }

    const user = demoUsers.find(item => item.userName.toLowerCase() === userName.toLowerCase());

    if (!user || user.password !== password) {
      return null;
    }

    return this.issueTokens(user.userId);
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
    if (this.isDevAuth() && token === devAccessToken) {
      return this.toUserInfo(this.getUserById(devUserId));
    }

    const userId = this.accessTokens.get(token);

    if (!userId) {
      return null;
    }

    return this.toUserInfo(this.getUserById(userId));
  }

  /** Rotate access and refresh tokens from an existing refresh token. */
  refresh(refreshToken: string): LoginToken | null {
    if (this.isDevAuth() && refreshToken === devRefreshToken) {
      return this.issueTokens(devUserId);
    }

    const userId = this.refreshTokens.get(refreshToken);

    if (!userId) {
      return null;
    }

    this.refreshTokens.delete(refreshToken);

    return this.issueTokens(userId);
  }

  /** Revoke one access token for an explicit logout action. */
  logout(token: string) {
    if (this.isDevAuth() && token === devAccessToken) {
      return;
    }

    this.accessTokens.delete(token);
  }

  private issueTokens(userId: string): LoginToken {
    if (this.isDevAuth() && userId === devUserId) {
      return {
        token: devAccessToken,
        refreshToken: devRefreshToken
      };
    }

    const token = `access_${randomUUID()}`;
    const refreshToken = `refresh_${randomUUID()}`;

    this.accessTokens.set(token, userId);
    this.refreshTokens.set(refreshToken, userId);

    return {
      token,
      refreshToken
    };
  }

  private getUserById(userId: string) {
    return demoUsers.find(item => item.userId === userId) || null;
  }

  private toUserInfo(user: DemoUser | null): UserInfo | null {
    if (!user) {
      return null;
    }

    const { userId, userName, roles, buttons } = user;

    return {
      userId,
      userName,
      roles,
      buttons
    };
  }

  private isDevAuth() {
    return process.env.NODE_ENV !== 'production';
  }
}
