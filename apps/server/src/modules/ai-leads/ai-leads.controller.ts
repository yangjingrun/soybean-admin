import { randomUUID } from 'node:crypto';
import { Body, Controller, Delete, Get, Inject, Optional, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { aiLeadsKeywordStrategyManagePermission, aiLeadsQueueConfigManagePermission } from '@soybean/shared';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { ok } from '../../shared/api-response';
import { requirePermission, requireSuperUserContext } from '../../shared/permission-policy';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import { CurrentContext } from '../auth/auth.decorators';
import { AiLeadsService } from './ai-leads.service';
import { SaveDirectorySourceRuleDto } from './dto/directory-source-rule.dto';
import { KeywordHistoryQueryDto, UpdateKeywordHistoryDto } from './dto/keyword-history.dto';
import { KeywordOptimizeDto } from './dto/keyword-optimize.dto';
import { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import { CreateSearchTaskDto, SaveAiLeadQueueConfigDto } from './dto/search-task.dto';
import { AiLeadDirectorySourceRuleService } from './ai-lead-directory-source-rule.service';
import { AiLeadSearchTaskService } from './ai-lead-search-task.service';
import { createLeadSearchProgressEmitter, serializeLeadSearchProgressEvent } from './ai-lead-search-progress';

@Controller('ai-leads')
export class AiLeadsController {
  constructor(
    @Inject(AiLeadsService) private readonly aiLeadsService: AiLeadsService,
    @Inject(AiLeadSearchTaskService) private readonly searchTaskService: AiLeadSearchTaskService,
    @Optional()
    @Inject(AiLeadDirectorySourceRuleService)
    private readonly directorySourceRuleService?: AiLeadDirectorySourceRuleService
  ) {}

  @Post('keyword-optimize')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async optimizeKeywords(
    @Body() dto: KeywordOptimizeDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.aiLeadsService.optimizeKeywords(dto, { user }));
  }

  @Post('search-orchestrate')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async searchOrchestrate(
    @Body() dto: SearchOrchestrateDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.aiLeadsService.searchOrchestrate(dto, { user }));
  }

  @Post('search-orchestrate/stream')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async searchOrchestrateStream(
    @Body() dto: SearchOrchestrateDto,
    @CurrentContext() currentContext: RequestUserContext | null = null,
    @Res() reply: FastifyReply
  ) {
    const user = requireRequestUserContext(currentContext);
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
    } catch (error) {
      const message = readStreamErrorMessage(error);

      await reporter.emit({
        type: 'workflow_failed',
        title: '搜索采集失败',
        description: message,
        errorMessage: message
      });
    } finally {
      reply.raw.end();
    }
  }

  @Post('search-tasks')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createSearchTask(
    @Body() dto: CreateSearchTaskDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.createTask(dto, { user }));
  }

  @Get('search-tasks/current')
  async getCurrentSearchTask(@CurrentContext() currentContext: RequestUserContext | null = null) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.getCurrentTask({ user }));
  }

  @Get('search-tasks/:id')
  async getSearchTask(@Param('id') id: string, @CurrentContext() currentContext: RequestUserContext | null = null) {
    const user = requireRequestUserContext(currentContext);
    const task = await this.searchTaskService.getTaskById(id, { user });

    return ok(task);
  }

  @Post('search-tasks/:id/interrupt')
  async interruptSearchTask(
    @Param('id') id: string,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.interruptTask(id, { user }));
  }

  @Post('search-tasks/:id/resume')
  async resumeSearchTask(@Param('id') id: string, @CurrentContext() currentContext: RequestUserContext | null = null) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.resumeTask(id, { user }));
  }

  @Post('search-tasks/:id/retry')
  async retrySearchTask(@Param('id') id: string, @CurrentContext() currentContext: RequestUserContext | null = null) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.retryTask(id, { user }));
  }

  @Post('search-tasks/:id/discard')
  async discardSearchTask(@Param('id') id: string, @CurrentContext() currentContext: RequestUserContext | null = null) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.discardTask(id, { user }));
  }

  @Post('search-tasks/:id/read')
  async markSearchTaskRead(
    @Param('id') id: string,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.searchTaskService.markTaskRead(id, { user }));
  }

  @Get('queue-config')
  async getQueueConfig(@CurrentContext() currentContext: RequestUserContext | null = null) {
    this.requireQueueConfigPermission(requireRequestUserContext(currentContext));

    return ok(await this.searchTaskService.getQueueConfig());
  }

  @Post('queue-config')
  async saveQueueConfig(
    @Body() dto: SaveAiLeadQueueConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);
    this.requireQueueConfigPermission(user);

    return ok(await this.searchTaskService.saveQueueConfig(dto.workerConcurrency, { user }));
  }

  @Get('directory-source-rules')
  async listDirectorySourceRules(@CurrentContext() currentContext: RequestUserContext | null = null) {
    this.requireDirectorySourceRulePermission(requireRequestUserContext(currentContext));

    return ok({ records: await this.requireDirectorySourceRuleService().listRules() });
  }

  @Post('directory-source-rules')
  async createDirectorySourceRule(
    @Body() dto: SaveDirectorySourceRuleDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = this.requireDirectorySourceRulePermission(requireRequestUserContext(currentContext));

    return ok(await this.requireDirectorySourceRuleService().createRule({ ...dto, user }));
  }

  @Patch('directory-source-rules/:id')
  async updateDirectorySourceRule(
    @Param('id') id: string,
    @Body() dto: SaveDirectorySourceRuleDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = this.requireDirectorySourceRulePermission(requireRequestUserContext(currentContext));

    return ok(await this.requireDirectorySourceRuleService().updateRule({ ...dto, id, user }));
  }

  @Delete('directory-source-rules/:id')
  async deleteDirectorySourceRule(
    @Param('id') id: string,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.requireDirectorySourceRulePermission(requireRequestUserContext(currentContext));

    return ok({ success: await this.requireDirectorySourceRuleService().deleteRule(id) });
  }

  @Get('keyword-histories')
  async listKeywordHistories(
    @Query() query: KeywordHistoryQueryDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);

    return ok(await this.aiLeadsService.listKeywordHistories(query, { user }));
  }

  @Patch('keyword-histories/:id')
  async updateKeywordHistory(
    @Param('id') id: string,
    @Body() dto: UpdateKeywordHistoryDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);
    this.requireKeywordStrategyPermission(user);

    return ok(await this.aiLeadsService.updateKeywordHistory(id, dto, { user }));
  }

  @Delete('keyword-histories/:id')
  async deleteKeywordHistory(
    @Param('id') id: string,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireRequestUserContext(currentContext);
    this.requireKeywordStrategyPermission(user);

    return ok(await this.aiLeadsService.deleteKeywordHistory(id, { user }));
  }

  private requireKeywordStrategyPermission(user: RequestUserContext) {
    requirePermission(user, aiLeadsKeywordStrategyManagePermission, '无权维护 AI 获客搜索策略');
  }

  private requireQueueConfigPermission(user: RequestUserContext) {
    requirePermission(user, aiLeadsQueueConfigManagePermission, '无权维护 AI 获客任务配置');
  }

  private requireDirectorySourceRulePermission(user: RequestUserContext) {
    return requireSuperUserContext(user, '只有超级管理员可以维护 AI 获客黄页过滤字典');
  }

  private requireDirectorySourceRuleService() {
    if (!this.directorySourceRuleService) {
      throw new Error('AI 获客黄页过滤规则服务未配置');
    }

    return this.directorySourceRuleService;
  }
}

function readStreamErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '搜索采集失败，请稍后重试';
}
