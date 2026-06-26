import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, UnauthorizedException, type ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('maps unauthorized exceptions to 8888', () => {
    const response = createFastifyResponse();

    new ApiExceptionFilter().catch(new UnauthorizedException('请先登录'), createArgumentsHost(response));

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, {
      code: '8888',
      msg: '请先登录',
      data: null
    });
  });

  it('maps forbidden exceptions to 403', () => {
    const response = createFastifyResponse();

    new ApiExceptionFilter().catch(new ForbiddenException('无权访问'), createArgumentsHost(response));

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, {
      code: '403',
      msg: '无权访问',
      data: null
    });
  });

  it('joins validation bad request message arrays', () => {
    const response = createFastifyResponse();
    const exception = new BadRequestException({
      message: ['name should not be empty', 'email must be an email'],
      error: 'Bad Request',
      statusCode: 400
    });

    new ApiExceptionFilter().catch(exception, createArgumentsHost(response));

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      code: '400',
      msg: 'name should not be empty，email must be an email',
      data: null
    });
  });

  it('maps unknown exceptions to internal server error without leaking stack', () => {
    const response = createFastifyResponse();

    new ApiExceptionFilter().catch(new Error('database password leaked in stack'), createArgumentsHost(response));

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      code: '500',
      msg: 'Internal server error',
      data: null
    });
    assert.equal(Object.hasOwn(response.body || {}, 'stack'), false);
  });

  it('records unknown exceptions with request context when a log recorder is provided', async () => {
    const response = createFastifyResponse();
    const records: unknown[] = [];
    const logger = {
      async record(input: unknown) {
        records.push(input);
      }
    };

    new ApiExceptionFilter(logger).catch(
      new Error('database unavailable'),
      createArgumentsHost(response, {
        method: 'POST',
        url: '/crm/accounts',
        user: { userId: 'user-1', userName: 'Alice' }
      })
    );
    await Promise.resolve();

    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      level: 'error',
      status: 'failed',
      module: 'server',
      action: 'unhandled-exception',
      message: '后端接口出现未处理异常',
      userId: 'user-1',
      userName: 'Alice',
      errorMessage: 'database unavailable',
      metadata: {
        method: 'POST',
        url: '/crm/accounts',
        errorCategory: 'unexpected',
        errorName: 'Error'
      }
    });
  });

  it('does not record handled http exceptions as unhandled errors', async () => {
    const response = createFastifyResponse();
    let recordCount = 0;
    const logger = {
      async record() {
        recordCount += 1;
      }
    };

    new ApiExceptionFilter(logger).catch(new ForbiddenException('无权访问'), createArgumentsHost(response));
    await Promise.resolve();

    assert.equal(recordCount, 0);
  });
});

interface FakeFastifyResponse {
  statusCode?: number;
  body?: unknown;
  status(code: number): FakeFastifyResponse;
  send(body: unknown): void;
}

function createFastifyResponse(): FakeFastifyResponse {
  return {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.body = body;
    }
  };
}

interface FakeFastifyRequest {
  method?: string;
  url?: string;
  user?: {
    userId?: string;
    userName?: string;
  };
}

function createArgumentsHost(response: FakeFastifyResponse, request: FakeFastifyRequest = {}): ArgumentsHost {
  return {
    switchToHttp() {
      return {
        getRequest: () => request,
        getResponse: () => response
      };
    }
  } as ArgumentsHost;
}
