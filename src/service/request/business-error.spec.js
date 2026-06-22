import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleRequestBusinessError, setRequestBusinessErrorHandler } from './business-error';
describe('request business error helpers', () => {
  it('dispatches missing model config errors to the registered handler', () => {
    const received = [];
    setRequestBusinessErrorHandler(error => {
      received.push(`${error.type}:${error.message}`);
      return true;
    });
    assert.equal(handleRequestBusinessError('未找到模型配置：default'), true);
    assert.deepEqual(received, ['missing-model-config:未找到模型配置：default']);
    setRequestBusinessErrorHandler(null);
  });
  it('does not handle regular request errors', () => {
    setRequestBusinessErrorHandler(() => true);
    assert.equal(handleRequestBusinessError('Request failed with status code 404'), false);
    setRequestBusinessErrorHandler(null);
  });
});
