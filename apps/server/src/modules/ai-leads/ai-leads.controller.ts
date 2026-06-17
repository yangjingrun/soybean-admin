import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { AiLeadsService } from './ai-leads.service';
import { KeywordOptimizeDto } from './dto/keyword-optimize.dto';

@Controller('ai-leads')
export class AiLeadsController {
  constructor(
    @Inject(AiLeadsService) private readonly aiLeadsService: AiLeadsService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Post('keyword-optimize')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async optimizeKeywords(@Body() dto: KeywordOptimizeDto, @Headers('authorization') authorization = '') {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    return ok(await this.aiLeadsService.optimizeKeywords(dto, { user }));
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
