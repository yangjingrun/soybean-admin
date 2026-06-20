import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { KeywordHistoryQueryDto, UpdateKeywordHistoryDto } from './keyword-history.dto';
import { KeywordOptimizeDto } from './keyword-optimize.dto';
import { SearchOrchestrateDto } from './search-orchestrate.dto';
import { CreateSearchTaskDto } from './search-task.dto';

describe('AI leads request DTOs', () => {
  it('trims requirement fields consistently before validation', () => {
    assert.equal(
      plainToInstance(KeywordOptimizeDto, { requirement: ' 找沙特轴承进口商 ' }).requirement,
      '找沙特轴承进口商'
    );
    assert.equal(
      plainToInstance(SearchOrchestrateDto, {
        requirement: ' 找沙特轴承进口商 ',
        targetLeadCount: 20
      }).requirement,
      '找沙特轴承进口商'
    );
    assert.equal(
      plainToInstance(CreateSearchTaskDto, {
        requirement: ' 找沙特轴承进口商 ',
        targetLeadCount: 20,
        keywordPlan: {}
      }).requirement,
      '找沙特轴承进口商'
    );
    assert.equal(
      plainToInstance(UpdateKeywordHistoryDto, {
        requirement: ' 找沙特轴承进口商 ',
        keywordPlan: {}
      }).requirement,
      '找沙特轴承进口商'
    );
  });

  it('rejects blank requirement strings at the DTO boundary', async () => {
    const errors = await validate(
      plainToInstance(CreateSearchTaskDto, {
        requirement: '   ',
        targetLeadCount: 20,
        keywordPlan: {}
      })
    );

    assert.equal(
      errors.some(error => error.property === 'requirement'),
      true
    );
  });

  it('converts numeric query values with DTO transformation', () => {
    const dto = plainToInstance(KeywordHistoryQueryDto, { size: '10' });

    assert.equal(dto.size, 10);
  });
});
