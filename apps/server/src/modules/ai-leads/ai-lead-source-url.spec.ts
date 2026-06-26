import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiLeadDirectorySourceRuleService } from './ai-lead-directory-source-rule.service';
import { isDirectorySourceUrl, normalizeDirectorySourceRuleValue } from './ai-lead-source-url';
import type { AiLeadDirectorySourceRuleStore } from './ai-lead-directory-source-rule.types';

describe('ai lead source url rules', () => {
  it('matches built-in directory domains and subdomains', () => {
    assert.equal(isDirectorySourceUrl('https://www.yellowpages-uae.com/uae/industrial-bearing'), true);
    assert.equal(isDirectorySourceUrl('https://reachuae.com/uae/bearings-c54'), true);
    assert.equal(isDirectorySourceUrl('https://abc.example.com'), false);
  });

  it('normalizes configurable domain rules before matching', () => {
    assert.equal(normalizeDirectorySourceRuleValue('https://www.Example-Directory.com/listing', 'domain_suffix'), 'example-directory.com');
    assert.equal(
      isDirectorySourceUrl('https://supplier.example-directory.com/company', [
        { value: 'example-directory.com', matchMode: 'domain_suffix' }
      ]),
      true
    );
  });

  it('merges custom enabled rules from the directory source rule service', async () => {
    const store: AiLeadDirectorySourceRuleStore = {
      async listRules() {
        return [
          {
            id: 'rule-1',
            value: 'custom-directory.test',
            matchMode: 'domain_suffix',
            enabled: true,
            builtin: false,
            description: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
      },
      async createRule() {
        throw new Error('not-used');
      },
      async updateRule() {
        throw new Error('not-used');
      },
      async deleteRule() {
        throw new Error('not-used');
      }
    };
    const service = new AiLeadDirectorySourceRuleService(store);

    assert.equal(await service.isDirectorySourceUrl('https://custom-directory.test/listing/123'), true);
  });
});
