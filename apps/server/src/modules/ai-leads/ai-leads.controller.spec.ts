import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { aiLeadsKeywordStrategyManagePermission } from '@soybean/shared';
import type { FastifyReply } from 'fastify';
import type { RequestUserContext } from '../../shared/request-context';
import { AiLeadsController } from './ai-leads.controller';
import type { AiLeadsContext } from './ai-leads.service';
import type { AiLeadsService } from './ai-leads.service';
import type { AiLeadSearchTaskService } from './ai-lead-search-task.service';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import type { LeadSearchProgressReporter } from './ai-lead-search-progress';

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
            keywordPlan: {} as Api.AiLeads.OptimizedKeywordPlan
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
        keywordPlan: {} as Api.AiLeads.OptimizedKeywordPlan
      },
      user
    );
    await controller.deleteKeywordHistory('history-1', user);

    assert.deepEqual(calls, ['update', 'delete']);
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
