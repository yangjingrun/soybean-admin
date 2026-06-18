import { Body, Controller, Get, Headers, Inject, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { fail, ok } from '../../shared/api-response';
import { SystemLogService } from '../system-log/system-log.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() request: AuthRequestLike) {
    const token = await this.authService.login(
      dto.userName,
      dto.password,
      dto.captchaId,
      dto.captchaCode,
      getClientIp(request)
    );

    if (!token) {
      await this.recordAuthLog({
        level: 'warn',
        status: 'failed',
        action: 'login',
        message: '用户登录失败',
        errorCode: '1001',
        errorMessage: '验证码错误或账号密码错误',
        request,
        metadata: {
          userName: dto.userName
        }
      });

      return fail('1001', '验证码错误或账号密码错误', null);
    }

    const user = this.authService.getUserByAccessToken(token.token);

    await this.recordAuthLog({
      level: 'info',
      status: 'success',
      action: 'login',
      message: '用户登录成功',
      request,
      userId: user?.userId,
      userName: user?.userName
    });

    return ok(token);
  }

  @Get('captcha')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async captcha() {
    return ok(await this.authService.createCaptcha());
  }

  @Get('getUserInfo')
  getUserInfo(@Headers('authorization') authorization = '') {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    if (!user) {
      return fail('8888', '登录状态已失效', null);
    }

    return ok(user);
  }

  @Post('refreshToken')
  refreshToken(@Body() dto: RefreshTokenDto) {
    const token = this.authService.refresh(dto.refreshToken);

    if (!token) {
      return fail('8888', '刷新令牌已失效', null);
    }

    return ok(token);
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization = '', @Req() request: AuthRequestLike) {
    const token = this.extractBearerToken(authorization);
    const user = this.authService.getUserByAccessToken(token);

    this.authService.logout(token);

    await this.recordAuthLog({
      level: 'info',
      status: 'success',
      action: 'logout',
      message: '用户退出登录',
      request,
      userId: user?.userId,
      userName: user?.userName
    });

    return ok(null);
  }

  @Get('error')
  customError(@Query('code') code?: string, @Query('msg') msg?: string) {
    return fail(code || '1000', msg || '自定义错误', null);
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }

  private async recordAuthLog(input: AuthLogInput) {
    await this.systemLogService.record({
      level: input.level,
      status: input.status,
      module: 'auth',
      action: input.action,
      message: input.message,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.userName ? { userName: input.userName } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      metadata: {
        ip: getClientIp(input.request),
        userAgent: getHeaderValue(input.request.headers['user-agent']),
        ...input.metadata
      }
    });
  }
}

function getClientIp(request: AuthRequestLike) {
  const forwardedFor = getHeaderValue(request.headers['x-forwarded-for']);

  return forwardedFor.split(',')[0]?.trim() || getHeaderValue(request.headers['x-real-ip']) || request.ip || '';
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

interface AuthRequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface AuthLogInput {
  level: 'info' | 'warn' | 'error';
  status: 'success' | 'failed';
  action: 'login' | 'logout';
  message: string;
  request: AuthRequestLike;
  userId?: string;
  userName?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
