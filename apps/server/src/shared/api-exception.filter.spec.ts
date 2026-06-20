import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  type ArgumentsHost
} from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('maps unauthorized exceptions to 8888', () => {
    const response = createFastifyResponse();

    new ApiExceptionFilter().catch(new UnauthorizedException('请先登录'), createArgumentsHost(response));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      code: '8888',
      msg: '请先登录',
      data: null
    });
  });

  it('maps forbidden exceptions to 403', () => {
    const response = createFastifyResponse();

    new ApiExceptionFilter().catch(new ForbiddenException('无权访问'), createArgumentsHost(response));

    assert.equal(response.statusCode, 200);
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

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      code: '400',
      msg: 'name should not be empty，email must be an email',
      data: null
    });
  });

  it('maps unknown exceptions to internal server error without leaking stack', () => {
    const response = createFastifyResponse();

    new ApiExceptionFilter().catch(new Error('database password leaked in stack'), createArgumentsHost(response));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      code: '500',
      msg: 'Internal server error',
      data: null
    });
    assert.equal(Object.hasOwn(response.body || {}, 'stack'), false);
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

function createArgumentsHost(response: FakeFastifyResponse): ArgumentsHost {
  return {
    switchToHttp() {
      return {
        getResponse: () => response
      };
    }
  } as ArgumentsHost;
}
