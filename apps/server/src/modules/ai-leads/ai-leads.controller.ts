import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { AiLeadsService } from './ai-leads.service';
import { KeywordHistoryQueryDto, UpdateKeywordHistoryDto } from './dto/keyword-history.dto';
import { KeywordOptimizeDto } from './dto/keyword-optimize.dto';
import { SearchOrchestrateDto } from './dto/search-orchestrate.dto';

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

  @Post('search-orchestrate')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async searchOrchestrate(@Body() dto: SearchOrchestrateDto, @Headers('authorization') authorization = '') {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    return ok(await this.aiLeadsService.searchOrchestrate(dto, { user }));
  }

  @Get('keyword-histories')
  async listKeywordHistories(@Query() query: KeywordHistoryQueryDto, @Headers('authorization') authorization = '') {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    return ok(await this.aiLeadsService.listKeywordHistories(query, { user }));
  }

  @Patch('keyword-histories/:id')
  async updateKeywordHistory(
    @Param('id') id: string,
    @Body() dto: UpdateKeywordHistoryDto,
    @Headers('authorization') authorization = ''
  ) {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    return ok(await this.aiLeadsService.updateKeywordHistory(id, dto, { user }));
  }

  @Delete('keyword-histories/:id')
  async deleteKeywordHistory(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    return ok(await this.aiLeadsService.deleteKeywordHistory(id, { user }));
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
