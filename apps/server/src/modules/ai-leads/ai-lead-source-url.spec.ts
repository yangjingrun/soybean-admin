import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiLeadDirectorySourceRuleService } from './ai-lead-directory-source-rule.service';
import {
  type AiLeadDirectorySourceMatcherRule,
  isDirectorySourceUrl,
  normalizeDirectorySourceRuleValue
} from './ai-lead-source-url';
import type { AiLeadDirectorySourceRuleStore } from './ai-lead-directory-source-rule.types';

const seededDirectoryRules: AiLeadDirectorySourceMatcherRule[] = [
  { value: 'yellowpages-uae.com', matchMode: 'domain_suffix' },
  { value: 'reachuae.com', matchMode: 'domain_suffix' },
  { value: 'yellowpages-uae.ae', matchMode: 'domain_suffix' },
  { value: 'yello.ae', matchMode: 'domain_suffix' },
  { value: 'aiwa.ae', matchMode: 'domain_suffix' },
  { value: 'uaebusinessdirectory.com', matchMode: 'domain_suffix' },
  { value: 'yallapages.ae', matchMode: 'domain_suffix' },
  { value: 'allofgcc.com', matchMode: 'domain_suffix' },
  { value: 'thegulfdirectory.com', matchMode: 'domain_suffix' }
];

describe('ai lead source url rules', () => {
  it('matches built-in directory domains and subdomains', () => {
    assert.equal(
      isDirectorySourceUrl('https://www.yellowpages-uae.com/uae/industrial-bearing', seededDirectoryRules),
      true
    );
    assert.equal(isDirectorySourceUrl('https://reachuae.com/uae/bearings-c54', seededDirectoryRules), true);
    assert.equal(isDirectorySourceUrl('https://abc.example.com', seededDirectoryRules), false);
  });

  it('matches expanded built-in directory domains collected from GCC directory sources', () => {
    const directoryUrls = [
      'https://www.yellowpages-uae.ae/search/bearings',
      'https://www.yello.ae/category/bearings',
      'https://aiwa.ae/company/abc-bearing',
      'https://uaebusinessdirectory.com/company/industrial-bearing',
      'https://www.yallapages.ae/listing/bearing-suppliers',
      'https://allofgcc.com/businesses/bearing-supplier',
      'https://thegulfdirectory.com/company/bearing-trading'
    ];

    for (const url of directoryUrls) {
      assert.equal(isDirectorySourceUrl(url, seededDirectoryRules), true, `${url} should be treated as directory source`);
    }
  });

  it('normalizes configurable domain rules before matching', () => {
    assert.equal(
      normalizeDirectorySourceRuleValue('https://www.Example-Directory.com/listing', 'domain_suffix'),
      'example-directory.com'
    );
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
