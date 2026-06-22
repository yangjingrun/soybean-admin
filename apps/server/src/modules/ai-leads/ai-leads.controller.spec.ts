import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { aiLeadsKeywordStrategyManagePermission, aiLeadsQueueConfigManagePermission } from '@soybean/shared';
import type { FastifyReply } from 'fastify';
import type { RequestUserContext } from '../../shared/request-context';
import { AiLeadsController } from './ai-leads.controller';
import type { AiLeadsContext } from './ai-leads.service';
import type { AiLeadsService } from './ai-leads.service';
import type { AiLeadSearchTaskService } from './ai-lead-search-task.service';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import type { LeadSearchProgressReporter } from './ai-lead-search-progress';
import type { OptimizedKeywordPlan } from './ai-lead-search-orchestrator.service';

describe('AiLeadsController', () => {
  it('rejects anonymous synchronous search orchestration before calling the service', async () => {
    let called = false;
    const controller = new AiLeadsController(
      {
        async searchOrchestrate() {
          called = true;
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(
      () =>
        controller.searchOrchestrate(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20
          },
          null
        ),
      UnauthorizedException
    );
    assert.equal(called, false);
  });

  it('does not resolve synchronous search orchestration from authorization headers', async () => {
    let called = false;
    const controller = new AiLeadsController(
      {
        async searchOrchestrate() {
          called = true;
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(
      () =>
        controller.searchOrchestrate(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20
          },
          null
        ),
      UnauthorizedException
    );
    assert.equal(called, false);
  });

  it('rejects anonymous stream search orchestration before opening the stream', async () => {
    const reply = createReply();
    let called = false;
    const controller = new AiLeadsController(
      {
        async searchOrchestrateStream() {
          called = true;
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(
      () =>
        controller.searchOrchestrateStream(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20
          },
          null,
          reply.reply
        ),
      UnauthorizedException
    );
    assert.equal(called, false);
    assert.equal(reply.statusCode, 0);
    assert.equal(reply.ended, false);
  });

  it('writes search progress as NDJSON stream events', async () => {
    const reply = createReply();
    const user = createUser(['R_SUPER']);
    const controller = new AiLeadsController(
      {
        async searchOrchestrateStream(
          _dto: SearchOrchestrateDto,
          _context: AiLeadsContext,
          reporter?: LeadSearchProgressReporter
        ) {
          await reporter?.emit({
            type: 'workflow_started',
            title: '开始搜索采集',
            description: '正在准备采集任务'
          });

          return { stopReason: '所有查询已完成' };
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );

    await controller.searchOrchestrateStream(
      {
        requirement: '找沙特轴承进口商',
        targetLeadCount: 20
      },
      user,
      reply.reply
    );

    assert.equal(reply.statusCode, 200);
    assert.equal(reply.headers['Content-Type'], 'application/x-ndjson; charset=utf-8');
    assert.equal(reply.ended, true);
    assert.equal(reply.chunks.length, 1);
    const event = JSON.parse(reply.chunks[0]);
    assert.equal(event.type, 'workflow_started');
    assert.equal(event.title, '开始搜索采集');
    assert.equal(event.sequence, 1);
    assert.match(event.runId, /^[0-9a-f-]+$/i);
  });

  it('keeps personal model config errors visible in stream failures', async () => {
    const reply = createReply();
    const user = createUser(['R_SUPER']);
    const controller = new AiLeadsController(
      {
        async searchOrchestrateStream() {
          throw new BadRequestException('请先配置个人模型通道');
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );

    await controller.searchOrchestrateStream(
      {
        requirement: '找沙特轴承进口商',
        targetLeadCount: 20
      },
      user,
      reply.reply
    );

    assert.equal(reply.statusCode, 200);
    assert.equal(reply.ended, true);
    assert.equal(reply.chunks.length, 1);
    const event = JSON.parse(reply.chunks[0]);
    assert.equal(event.type, 'workflow_failed');
    assert.equal(event.description, '请先配置个人模型通道');
    assert.equal(event.errorMessage, '请先配置个人模型通道');
  });

  it('requires keyword strategy permission before updating keyword history', async () => {
    let called = false;
    const controller = new AiLeadsController(
      {
        async updateKeywordHistory() {
          called = true;
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(
      () =>
        controller.updateKeywordHistory(
          'history-1',
          {
            requirement: '找韩国轴承经销商',
            keywordPlan: {} as OptimizedKeywordPlan
          },
          createUser(['R_USER'])
        ),
      ForbiddenException
    );
    assert.equal(called, false);
  });

  it('allows users with keyword strategy permission to update and delete keyword history', async () => {
    const calls: string[] = [];
    const controller = new AiLeadsController(
      {
        async updateKeywordHistory() {
          calls.push('update');
          return { id: 'history-1' };
        },
        async deleteKeywordHistory() {
          calls.push('delete');
          return { id: 'history-1' };
        }
      } as unknown as AiLeadsService,
      {} as unknown as AiLeadSearchTaskService
    );
    const user = createUser(['R_USER'], [aiLeadsKeywordStrategyManagePermission]);

    await controller.updateKeywordHistory(
      'history-1',
      {
        requirement: '找韩国轴承经销商',
        keywordPlan: {} as OptimizedKeywordPlan
      },
      user
    );
    await controller.deleteKeywordHistory('history-1', user);

    assert.deepEqual(calls, ['update', 'delete']);
  });

  it('requires queue config permission before loading AI leads queue config', async () => {
    let called = false;
    const controller = new AiLeadsController(
      {} as unknown as AiLeadsService,
      {
        async getQueueConfig() {
          called = true;
        }
      } as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(() => controller.getQueueConfig(createUser(['R_USER'])), ForbiddenException);
    assert.equal(called, false);
  });

  it('allows assigned roles to manage AI leads queue config', async () => {
    const calls: string[] = [];
    const controller = new AiLeadsController(
      {} as unknown as AiLeadsService,
      {
        async getQueueConfig() {
          calls.push('get');
          return { workerConcurrency: 2 };
        },
        async saveQueueConfig(_workerConcurrency: number) {
          calls.push('save');
          return { workerConcurrency: 3 };
        }
      } as unknown as AiLeadSearchTaskService
    );
    const user = createUser(['R_USER'], [aiLeadsQueueConfigManagePermission]);

    const loaded = await controller.getQueueConfig(user);
    const saved = await controller.saveQueueConfig({ workerConcurrency: 3 }, user);

    assert.deepEqual(calls, ['get', 'save']);
    assert.equal(loaded.data.workerConcurrency, 2);
    assert.equal(saved.data.workerConcurrency, 3);
  });
});

function createUser(roles = ['R_ADMIN'], buttons: string[] = []): RequestUserContext {
  return {
    userId: 'u-1',
    userName: 'Super',
    roles,
    buttons,
    organizationId: 'org-1',
    organizationRole: 'admin'
  };
}

function createReply() {
  const state = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    ended: false,
    reply: {
      raw: {
        writeHead(statusCode: number, headers: Record<string, string>) {
          state.statusCode = statusCode;
          state.headers = headers;
        },
        write(chunk: string) {
          state.chunks.push(chunk);
        },
        end() {
          state.ended = true;
        }
      }
    } as unknown as FastifyReply
  };

  return state;
}
