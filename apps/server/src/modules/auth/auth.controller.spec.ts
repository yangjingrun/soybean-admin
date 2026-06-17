import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import type { SystemLogService } from '../system-log/system-log.service';

describe('AuthController', () => {
  it('records login success with client IP and user agent', async () => {
    const logs = createLogRecorder();
    const controller = new AuthController(createAuthService({ loginUserId: '1' }), logs.service);

    const result = await controller.login(
      {
        userName: 'Super',
        password: '123456',
        captchaId: 'captcha',
        captchaCode: 'ABCDEF'
      },
      createRequest({
        ip: '127.0.0.1',
        userAgent: 'Chrome',
        xForwardedFor: '203.0.113.10, 10.0.0.1'
      })
    );

    assert.equal(result.code, '0000');
    assert.deepEqual(logs.records[0], {
      level: 'info',
      status: 'success',
      module: 'auth',
      action: 'login',
      message: '用户登录成功',
      userId: '1',
      userName: 'Super',
      metadata: {
        ip: '203.0.113.10',
        userAgent: 'Chrome'
      }
    });
  });

  it('records login failure with client IP', async () => {
    const logs = createLogRecorder();
    const controller = new AuthController(createAuthService({ loginUserId: null }), logs.service);

    const result = await controller.login(
      {
        userName: 'Ghost',
        password: 'bad-password',
        captchaId: 'captcha',
        captchaCode: 'ABCDEF'
      },
      createRequest({
        ip: '127.0.0.1',
        userAgent: 'Chrome'
      })
    );

    assert.equal(result.code, '1001');
    assert.deepEqual(logs.records[0], {
      level: 'warn',
      status: 'failed',
      module: 'auth',
      action: 'login',
      message: '用户登录失败',
      errorCode: '1001',
      errorMessage: '验证码错误或账号密码错误',
      metadata: {
        ip: '127.0.0.1',
        userAgent: 'Chrome',
        userName: 'Ghost'
      }
    });
  });

  it('records logout and clears token', async () => {
    const logs = createLogRecorder();
    const auth = createAuthService({ loginUserId: '1' });
    const controller = new AuthController(auth, logs.service);

    const result = await controller.logout('Bearer access-token', createRequest({ ip: '127.0.0.1' }));

    assert.equal(result.code, '0000');
    assert.deepEqual(auth.revokedTokens, ['access-token']);
    assert.deepEqual(logs.records[0], {
      level: 'info',
      status: 'success',
      module: 'auth',
      action: 'logout',
      message: '用户退出登录',
      userId: '1',
      userName: 'Super',
      metadata: {
        ip: '127.0.0.1',
        userAgent: ''
      }
    });
  });
});

function createLogRecorder() {
  const records: SystemLogRecordInput[] = [];

  return {
    records,
    service: {
      async record(input: SystemLogRecordInput) {
        records.push(input);
      }
    } as unknown as SystemLogService
  };
}

function createAuthService(options: { loginUserId: string | null }) {
  const revokedTokens: string[] = [];
  const user = {
    userId: '1',
    userName: 'Super',
    roles: ['R_SUPER'],
    buttons: []
  };

  return {
    revokedTokens,
    async login() {
      return options.loginUserId
        ? {
            token: 'access-token',
            refreshToken: 'refresh-token'
          }
        : null;
    },
    getUserByAccessToken(token: string) {
      return token === 'access-token' ? user : null;
    },
    logout(token: string) {
      revokedTokens.push(token);
    }
  } as unknown as AuthService & { revokedTokens: string[] };
}

function createRequest(options: { ip: string; userAgent?: string; xForwardedFor?: string }) {
  return {
    ip: options.ip,
    headers: {
      'user-agent': options.userAgent,
      'x-forwarded-for': options.xForwardedFor
    }
  } as AuthRequestLike;
}

interface AuthRequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
