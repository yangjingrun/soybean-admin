import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAiPromptOutput, validateAiPromptText, type AiPromptValidationResult } from './ai-prompt-validator';

describe('ai-prompt-validator', () => {
  it('passes a valid Maps keyword optimization JSON output', () => {
    const result = validateAiPromptOutput('lead_maps_keyword_optimize', createValidMapsOutput());

    assert.equal(result.ok, true);
    assert.equal(findItem(result, 'json-object')?.status, 'pass');
    assert.equal(findItem(result, 'maps-query-count')?.status, 'pass');
    assert.equal(findItem(result, 'search-empty')?.status, 'pass');
    assert.equal(findItem(result, 'places-empty')?.status, 'pass');
    assert.equal(findItem(result, 'maps-query-syntax')?.status, 'pass');
  });

  it('fails Maps output that leaks Search queries, has too few Maps queries, and pollutes q', () => {
    const output = createValidMapsOutput();

    output.serperSearchQueries = [{ endpoint: 'search', requestBody: { q: 'bearing importer' } }];
    output.serperMapsQueries = output.serperMapsQueries.slice(0, 4);
    output.serperMapsQueries[0].requestBody.q = 'site:example.com bearing distributor（轴承经销商）';
    output.extraField = true;

    const result = validateAiPromptOutput('lead_maps_keyword_optimize', output);

    assert.equal(result.ok, false);
    assert.equal(findItem(result, 'top-level-fields')?.status, 'fail');
    assert.equal(findItem(result, 'search-empty')?.status, 'fail');
    assert.equal(findItem(result, 'maps-query-count')?.status, 'fail');
    assert.equal(findItem(result, 'maps-query-syntax')?.status, 'fail');
  });

  it('checks required prompt text rules for Maps prompts', () => {
    const result = validateAiPromptText(
      'lead_maps_keyword_optimize',
      '你是 Maps Agent。只输出一个合法 JSON 对象。serperMapsQueries 输出 5-8 条。serperSearchQueries 必须是空数组。serperPlacesQueries 必须是空数组。不要新增 JSON 顶层字段。'
    );

    assert.equal(result.ok, true);
    assert.equal(findItem(result, 'prompt-non-empty')?.status, 'pass');
    assert.equal(findItem(result, 'prompt-required-rules')?.status, 'pass');
  });

  it('fails prompt text when required Maps rules are missing', () => {
    const result = validateAiPromptText('lead_maps_keyword_optimize', '请帮我生成地图关键词');

    assert.equal(result.ok, false);
    assert.equal(findItem(result, 'prompt-required-rules')?.status, 'fail');
    assert.match(findItem(result, 'prompt-required-rules')?.message || '', /serperMapsQueries/);
  });

  it('checks required CRM outreach prompt text rules', () => {
    const result = validateAiPromptText(
      'crm_outreach_ai_polish',
      [
        '只输出一个合法 JSON 对象',
        '不编造事实',
        '只使用公开/CRM 已提供事实',
        'follow-up 必须增加新价值',
        'subject line 避免 spam/clickbait',
        'ai_polish 只能润色表达，不能新增事实、承诺或 CTA'
      ].join('\n')
    );

    assert.equal(result.ok, true);
    assert.equal(findItem(result, 'prompt-required-rules')?.status, 'pass');
  });

  it('fails CRM outreach prompt text when grounding and polish rules are missing', () => {
    const result = validateAiPromptText('crm_outreach_ai_polish', '帮我把开发信写自然一点');

    assert.equal(result.ok, false);
    assert.equal(findItem(result, 'prompt-required-rules')?.status, 'fail');
    assert.match(findItem(result, 'prompt-required-rules')?.message || '', /不编造事实/);
    assert.match(findItem(result, 'prompt-required-rules')?.message || '', /不能新增事实、承诺或 CTA/);
  });
});

function findItem(result: AiPromptValidationResult, key: string) {
  return result.items.find(item => item.key === key);
}

function createValidMapsOutput(): Record<string, any> {
  return {
    resolvedProductKeywords: '轴承 bearing',
    resolvedTargetRegions: '美国纽约州',
    resolvedTargetCustomerProfile: '本地工业用品经销商和维修服务商',
    resolvedTargetLeadCount: null,
    structuredRequirement: '寻找美国纽约州有门店或地址电话的轴承相关 B2B 商家。',
    buyerSegments: [
      {
        buyerType: 'bearing distributor',
        purchaseReason: '分销轴承并服务本地工业客户',
        websiteSignals: ['Brands', 'Products'],
        priorityContacts: ['Purchasing Manager'],
        priorityLevel: '高',
        preferredSerperChannel: 'maps'
      },
      {
        buyerType: 'industrial supplier',
        purchaseReason: '向工厂提供 MRO 备件',
        websiteSignals: ['MRO', 'Catalog'],
        priorityContacts: ['Owner'],
        priorityLevel: '高',
        preferredSerperChannel: 'maps'
      },
      {
        buyerType: 'bearing repair service',
        purchaseReason: '维修场景会持续采购备件',
        websiteSignals: ['Repair', 'Services'],
        priorityContacts: ['Service Manager'],
        priorityLevel: '中',
        preferredSerperChannel: 'maps'
      }
    ],
    serperSearchQueries: [],
    serperPlacesQueries: [],
    serperMapsQueries: [
      createMapsQuery('bearing distributor', 'local_distributor'),
      createMapsQuery('bearing wholesale', 'local_wholesaler'),
      createMapsQuery('industrial supplier', 'industrial_supplier'),
      createMapsQuery('bearing repair service', 'repair_service'),
      createMapsQuery('power transmission supplier', 'mro_supplier')
    ],
    searchExecutionRules: {
      channelPriority: ['maps'],
      mapsUsage: 'Maps 用于查找本地经销商、工业用品供应商、维修服务商、门店型批发商等有地址电话的实体商家。',
      defaultDateRange: 'any_time',
      keep: ['distributor', 'industrial supplier'],
      exclude: ['school', 'blog'],
      websiteCheckPages: ['Products', 'Brands', 'Contact'],
      dedupeKeys: ['cid', 'placeId', 'website']
    }
  };
}

function createMapsQuery(q: string, intent: string) {
  return {
    endpoint: 'maps',
    requestBody: {
      q,
      hl: 'en',
      ll: '@41.6469296,-73.2681778,8z',
      page: 1
    },
    meta: {
      buyerType: 'bearing buyer',
      intent,
      city: 'New York',
      priority: '高',
      expectedPlaceTypes: ['Industrial equipment supplier'],
      reason: '这条适合用 Maps 找有地址电话的本地实体商家'
    }
  };
}
