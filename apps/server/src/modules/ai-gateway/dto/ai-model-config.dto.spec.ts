import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveMyAiModelConfigDto } from './ai-model-config.dto';

describe('AI model config DTOs', () => {
  it('accepts a personal model config payload without legacy platform fields', async () => {
    const dto = plainToInstance(SaveMyAiModelConfigDto, {
      providerName: ' openrouter ',
      apiBase: ' https://openrouter.ai/api/v1 ',
      apiKey: ' sk-test ',
      model: ' openai/gpt-4o-mini '
    });
    const errors = await validate(dto);

    assert.equal(errors.length, 0);
    assert.equal(dto.providerName, 'openrouter');
    assert.equal(dto.apiBase, 'https://openrouter.ai/api/v1');
    assert.equal(dto.apiKey, 'sk-test');
    assert.equal(dto.model, 'openai/gpt-4o-mini');
  });

  it('allows omitting apiKey when updating a personal model config with an existing saved key', async () => {
    const dto = plainToInstance(SaveMyAiModelConfigDto, {
      providerName: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini'
    });
    const errors = await validate(dto);

    assert.equal(errors.length, 0);
    assert.equal(dto.apiKey, undefined);
  });
});
