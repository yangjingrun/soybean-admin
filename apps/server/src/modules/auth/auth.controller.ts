import { Body, Controller, Get, Headers, Inject, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { fail, ok } from '../../shared/api-response';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    const token = await this.authService.login(dto.userName, dto.password, dto.captchaId, dto.captchaCode);

    if (!token) {
      return fail('1001', '验证码错误或账号密码错误', null);
    }

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

  @Get('error')
  customError(@Query('code') code?: string, @Query('msg') msg?: string) {
    return fail(code || '1000', msg || '自定义错误', null);
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
