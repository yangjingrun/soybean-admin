import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportCrmLeadDto } from './import-crm-lead.dto';

describe('ImportCrmLeadDto', () => {
  it('validates nested contact fields', async () => {
    const dto = plainToInstance(ImportCrmLeadDto, {
      name: 'ABC Trading',
      contact: {
        email: 123
      }
    });

    const errors = await validate(dto);

    assert.equal(
      errors.some(error => error.property === 'contact'),
      true
    );
  });
});
