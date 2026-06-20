import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getBackendErrorCode, getRequestErrorMessage, isMissingModelConfigError } from './error-message';

type RequestError = Parameters<typeof getRequestErrorMessage>[0];

describe('request error message helpers', () => {
  it('uses Nest http exception message before axios generic status text', () => {
    const error = {
      message: 'Request failed with status code 404',
      response: {
        data: {
          message: '未找到模型配置：default',
          error: 'Not Found',
          statusCode: 404
        }
      }
    } as unknown as RequestError;

    assert.equal(getRequestErrorMessage(error), '未找到模型配置：default');
  });

  it('uses service response msg before axios generic error text', () => {
    const error = {
      message: 'the backend request error',
      response: {
        data: {
          code: '9999',
          msg: '登录已过期'
        }
      }
    } as unknown as RequestError;

    assert.equal(getRequestErrorMessage(error), '登录已过期');
  });

  it('reads backend business code from non-2xx axios responses', () => {
    const error = {
      code: 'ERR_BAD_REQUEST',
      response: {
        status: 401,
        data: {
          code: '8888',
          msg: '请先登录'
        }
      }
    } as unknown as RequestError;

    assert.equal(getBackendErrorCode(error), '8888');
  });

  it('identifies backend missing model config errors', () => {
    assert.equal(isMissingModelConfigError('未找到模型配置：default'), true);
    assert.equal(isMissingModelConfigError('Model config default not found'), true);
    assert.equal(isMissingModelConfigError('Request failed with status code 404'), false);
  });
});
