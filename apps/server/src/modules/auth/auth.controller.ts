import { Body, Controller, Get, Headers, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { fail, ok } from '../../shared/api-response';
import { requireRequestUserContext } from '../../shared/request-context';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemLogService } from '../system-log/system-log.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';
import { CurrentContext, Public } from './auth.decorators';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService
  ) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() request: AuthRequestLike) {
    const token = await this.authService.login(
      dto.userName,
      dto.password,
      dto.captchaId,
      dto.captchaCode,
      getClientIp(request),
      getHeaderValue(request.headers['user-agent'])
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

    const user = await this.authService.getUserByAccessToken(token.token);

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
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async captcha() {
    return ok(await this.authService.createCaptcha());
  }

  @Get('getUserInfo')
  async getUserInfo(@Headers('authorization') authorization = '') {
    const user = await this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    if (!user) {
      return fail('8888', '登录状态已失效', null);
    }

    return ok(user);
  }

  @Post('refreshToken')
  @Public()
  async refreshToken(@Body() dto: RefreshTokenDto) {
    const token = await this.authService.refresh(dto.refreshToken);

    if (!token) {
      return fail('8888', '刷新令牌已失效', null);
    }

    return ok(token);
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization = '', @Req() request: AuthRequestLike) {
    const token = this.extractBearerToken(authorization);
    const user = await this.authService.getUserByAccessToken(token);

    await this.authService.logout(token);

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

  @Patch('profile')
  async updateProfile(
    @CurrentContext() context: RequestUserContext | null = null,
    @Body() dto: UpdateCurrentUserProfileDto,
    @Req() request: AuthRequestLike
  ) {
    const user = requireRequestUserContext(context);

    try {
      const updated = await this.authService.updateCurrentUserProfile(user.userId, dto);

      await this.recordAuthLog({
        level: 'info',
        status: 'success',
        action: 'update-profile',
        message: '用户更新个人信息',
        request,
        userId: user.userId,
        userName: user.userName,
        metadata: {
          changedFields: Object.keys(dto)
        }
      });

      return ok(updated);
    } catch (error) {
      await this.recordAuthLog({
        level: 'warn',
        status: 'failed',
        action: 'update-profile',
        message: '用户更新个人信息失败',
        request,
        userId: user.userId,
        userName: user.userName,
        errorMessage: getErrorMessage(error)
      });

      throw error;
    }
  }

  @Post('change-password')
  async changePassword(
    @CurrentContext() context: RequestUserContext | null = null,
    @Headers('authorization') authorization = '',
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthRequestLike
  ) {
    const user = requireRequestUserContext(context);

    try {
      await this.authService.changePassword(
        user.userId,
        dto.oldPassword,
        dto.newPassword,
        this.extractBearerToken(authorization)
      );
    } catch (error) {
      await this.recordAuthLog({
        level: 'warn',
        status: 'failed',
        action: 'change-password',
        message: '用户修改密码失败',
        request,
        userId: user.userId,
        userName: user.userName,
        errorMessage: getErrorMessage(error)
      });

      throw error;
    }

    await this.recordAuthLog({
      level: 'info',
      status: 'success',
      action: 'change-password',
      message: '用户修改密码',
      request,
      userId: user.userId,
      userName: user.userName
    });

    return ok(null);
  }

  @Get('error')
  @Public()
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误';
}

interface AuthRequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface AuthLogInput {
  level: 'info' | 'warn' | 'error';
  status: 'success' | 'failed';
  action: 'login' | 'logout' | 'change-password' | 'update-profile';
  message: string;
  request: AuthRequestLike;
  userId?: string;
  userName?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
