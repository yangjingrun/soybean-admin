import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import type { UserInfo } from '../auth/auth.types';
import { AiLeadsService } from './ai-leads.service';
import { KeywordHistoryQueryDto, UpdateKeywordHistoryDto } from './dto/keyword-history.dto';
import { KeywordOptimizeDto } from './dto/keyword-optimize.dto';
import { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import { CreateSearchTaskDto, SaveAiLeadQueueConfigDto } from './dto/search-task.dto';
import { AiLeadSearchTaskService } from './ai-lead-search-task.service';
import { createLeadSearchProgressEmitter, serializeLeadSearchProgressEvent } from './ai-lead-search-progress';

@Controller('ai-leads')
export class AiLeadsController {
  constructor(
    @Inject(AiLeadsService) private readonly aiLeadsService: AiLeadsService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AiLeadSearchTaskService) private readonly searchTaskService: AiLeadSearchTaskService
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
    const user = this.requireUser(authorization);

    return ok(await this.aiLeadsService.searchOrchestrate(dto, { user }));
  }

  @Post('search-orchestrate/stream')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async searchOrchestrateStream(
    @Body() dto: SearchOrchestrateDto,
    @Headers('authorization') authorization = '',
    @Res() reply: FastifyReply
  ) {
    const user = this.requireUser(authorization);
    const reporter = createLeadSearchProgressEmitter(randomUUID(), event => {
      reply.raw.write(serializeLeadSearchProgressEvent(event));
    });

    reply.raw.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    try {
      await this.aiLeadsService.searchOrchestrateStream(dto, { user }, reporter);
    } catch {
      await reporter.emit({
        type: 'workflow_failed',
        title: '搜索采集失败',
        description: '搜索采集失败，请稍后重试',
        errorMessage: '搜索采集失败，请稍后重试'
      });
    } finally {
      reply.raw.end();
    }
  }

  @Post('search-tasks')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createSearchTask(@Body() dto: CreateSearchTaskDto, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.createTask(dto, { user }));
  }

  @Get('search-tasks/current')
  async getCurrentSearchTask(@Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.getCurrentTask({ user }));
  }

  @Get('search-tasks/:id')
  async getSearchTask(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);
    const task = await this.searchTaskService.getTaskById(id, { user });

    return ok(task);
  }

  @Post('search-tasks/:id/interrupt')
  async interruptSearchTask(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.interruptTask(id, { user }));
  }

  @Post('search-tasks/:id/resume')
  async resumeSearchTask(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.resumeTask(id, { user }));
  }

  @Post('search-tasks/:id/retry')
  async retrySearchTask(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.retryTask(id, { user }));
  }

  @Post('search-tasks/:id/discard')
  async discardSearchTask(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.discardTask(id, { user }));
  }

  @Post('search-tasks/:id/read')
  async markSearchTaskRead(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.searchTaskService.markTaskRead(id, { user }));
  }

  @Get('queue-config')
  async getQueueConfig(@Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.searchTaskService.getQueueConfig());
  }

  @Post('queue-config')
  async saveQueueConfig(@Body() dto: SaveAiLeadQueueConfigDto, @Headers('authorization') authorization = '') {
    const user = this.assertSuper(authorization);

    return ok(await this.searchTaskService.saveQueueConfig(dto.workerConcurrency, { user }));
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

  private assertSuper(authorization: string) {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    if (!user?.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权维护 AI 获客任务配置');
    }

    return user;
  }

  private requireUser(authorization: string): UserInfo {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    if (!user?.userId) {
      throw new UnauthorizedException('请先登录');
    }

    return user;
  }
}
