import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { AuthService } from '../auth/auth.service';
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
      createAuthService(),
      {} as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(
      () =>
        controller.searchOrchestrate(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20
          },
          ''
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
      createAuthService(),
      {} as unknown as AiLeadSearchTaskService
    );

    await assert.rejects(
      () =>
        controller.searchOrchestrateStream(
          {
            requirement: '找沙特轴承进口商',
            targetLeadCount: 20
          },
          '',
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
      createAuthService(),
      {} as unknown as AiLeadSearchTaskService
    );

    await controller.searchOrchestrateStream(
      {
        requirement: '找沙特轴承进口商',
        targetLeadCount: 20
      },
      'Bearer access-token',
      null,
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
});

function createAuthService(): AuthService {
  return {
    getUserByAccessToken(token: string) {
      return token === 'access-token'
        ? {
            userId: 'u-1',
            userName: 'Super',
            roles: ['R_SUPER'],
            buttons: []
          }
        : null;
    }
  } as unknown as AuthService;
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
