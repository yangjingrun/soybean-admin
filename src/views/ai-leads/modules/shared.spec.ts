import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAiLeadCandidateImportPayload,
  buildAiLeadCandidateImportRows,
  buildKeywordHistoryUpdatePayload,
  createKeywordOptimizationViewModel,
  createAiResultFromKeywordHistory,
  formatAiFinishReason,
  formatKeywordOptimizationVisibleText,
  parseKeywordOptimizationPlan,
  normalizeAiLeadCandidateDomain,
  resolveTargetLeadCountAfterOptimization
} from './shared';

const keywordPlan: Api.AiLeads.OptimizedKeywordPlan = {
  resolvedProductKeywords: '6204 bearing, deep groove ball bearing',
  resolvedTargetRegions: '沙特阿拉伯',
  resolvedTargetCustomerProfile: '轴承进口商和工业品经销商',
  resolvedTargetLeadCount: null,
  structuredRequirement: '中国河北轴承供应商寻找沙特进口商和经销商。',
  buyerSegments: [
    {
      buyerType: 'Importer',
      purchaseReason: '补充本地轴承库存并转售给工业客户',
      websiteSignals: ['Import', 'Bearing catalog'],
      priorityContacts: ['Purchasing Manager'],
      priorityLevel: '高'
    }
  ],
  serperSearchQueries: [
    {
      endpoint: 'search',
      requestBody: {
        q: '6204 bearing importer Saudi Arabia',
        location: 'Saudi Arabia',
        gl: 'sa',
        hl: 'en',
        num: 10,
        page: 1
      },
      meta: {
        buyerType: 'Importer',
        intent: 'importer',
        priority: '高'
      }
    }
  ],
  serperPlacesQueries: [
    {
      endpoint: 'places',
      requestBody: {
        q: 'bearing supplier Riyadh',
        location: 'Riyadh, Saudi Arabia',
        gl: 'sa',
        hl: 'en',
        num: 10,
        page: 1
      },
      meta: {
        buyerType: 'Industrial supplier',
        intent: 'industrial_supplier',
        city: 'Riyadh',
        priority: '高',
        expectedPlaceTypes: ['Bearing supplier']
      }
    }
  ],
  searchExecutionRules: {
    keep: ['importer'],
    exclude: ['school'],
    websiteCheckPages: ['Products'],
    dedupeKeys: ['domain']
  }
};

describe('ai leads keyword optimization helpers', () => {
  it('parses the AI keyword optimization JSON text', () => {
    const result = parseKeywordOptimizationPlan(JSON.stringify(keywordPlan));

    assert.equal(result.resolvedProductKeywords, keywordPlan.resolvedProductKeywords);
    assert.equal(result.serperSearchQueries[0].requestBody?.q, '6204 bearing importer Saudi Arabia');
  });

  it('keeps business summary visible while hiding query details for regular users', () => {
    const viewModel = createKeywordOptimizationViewModel(keywordPlan, false);

    assert.equal(viewModel.summaryItems.length, 4);
    assert.equal(viewModel.buyerSegments.length, 1);
    assert.equal(viewModel.buyerSegments[0].buyerType, 'Importer（进口商）');
    assert.equal(viewModel.showQueryDetails, false);
    assert.deepEqual(viewModel.searchQueries, []);
    assert.deepEqual(viewModel.placesQueries, []);
  });

  it('shows Search and Places query details for super administrators', () => {
    const viewModel = createKeywordOptimizationViewModel(keywordPlan, true);

    assert.equal(viewModel.showQueryDetails, true);
    assert.equal(viewModel.searchQueries[0].q, '6204 bearing importer Saudi Arabia');
    assert.equal(viewModel.searchQueries[0].buyerType, 'Importer（进口商）');
    assert.equal(viewModel.placesQueries[0].q, 'bearing supplier Riyadh');
    assert.equal(viewModel.placesQueries[0].buyerType, 'Industrial supplier（工业用品供应商）');
    assert.equal(viewModel.placesQueries[0].intent, 'industrial_supplier（工业用品供应商）');
  });

  it('formats only visible fields when regular users copy the result', () => {
    const viewModel = createKeywordOptimizationViewModel(keywordPlan, false);
    const text = formatKeywordOptimizationVisibleText(viewModel);

    assert.match(text, /需求归纳：中国河北轴承供应商寻找沙特进口商和经销商。/);
    assert.match(text, /买家类型：Importer（进口商）/);
    assert.doesNotMatch(text, /6204 bearing importer Saudi Arabia/);
    assert.doesNotMatch(text, /bearing supplier Riyadh/);
  });

  it('restores ai result from a keyword history record', () => {
    const result = createAiResultFromKeywordHistory({
      id: 'history-1',
      requirement: '找沙特轴承进口商',
      resultText: JSON.stringify(keywordPlan),
      keywordPlan,
      finishReason: 'stop',
      usage: {
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20
      },
      createdAt: '2026-06-18T01:00:00.000Z',
      updatedAt: '2026-06-18T01:00:00.000Z'
    });

    assert.equal(result.text, JSON.stringify(keywordPlan));
    assert.deepEqual(result.usage, {
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20
    });
  });

  it('builds keyword history update payload from edited plan', () => {
    const editedPlan = {
      ...keywordPlan,
      resolvedProductKeywords: '6204 bearing supplier'
    };
    const payload = buildKeywordHistoryUpdatePayload(' 更新后的需求 ', editedPlan);

    assert.equal(payload.requirement, '更新后的需求');
    assert.equal(payload.keywordPlan.resolvedProductKeywords, '6204 bearing supplier');
  });

  it('formats AI finish reason for user-facing display', () => {
    assert.equal(formatAiFinishReason('stop'), '正常完成');
    assert.equal(formatAiFinishReason('length'), '输出被截断');
    assert.equal(formatAiFinishReason('content_filter'), '内容被过滤');
    assert.equal(formatAiFinishReason(''), '');
  });

  it('uses AI resolved lead count when the user has not edited the field', () => {
    const count = resolveTargetLeadCountAfterOptimization({
      currentValue: 20,
      resolvedValue: 50,
      isManuallyEdited: false,
      defaultValue: 20
    });

    assert.equal(count, 50);
  });

  it('keeps the manually edited lead count after keyword optimization', () => {
    const count = resolveTargetLeadCountAfterOptimization({
      currentValue: 30,
      resolvedValue: 50,
      isManuallyEdited: true,
      defaultValue: 20
    });

    assert.equal(count, 30);
  });

  it('keeps an empty manually edited lead count instead of applying AI output', () => {
    const count = resolveTargetLeadCountAfterOptimization({
      currentValue: null,
      resolvedValue: 50,
      isManuallyEdited: true,
      defaultValue: 20
    });

    assert.equal(count, null);
  });

  it('filters low-quality AI lead candidates before CRM import', () => {
    const rows = buildAiLeadCandidateImportRows([
      {
        title: 'Bearing House',
        website: 'https://www.bearing.example.com/products',
        snippet: 'Bearing supplier and industrial distributor',
        sourceLabel: '公开线索',
        sourceType: 'search',
        sourceUrl: 'https://google.example.com/result',
        score: 82,
        reason: 'Matches importer signal'
      },
      {
        title: 'Bearing House Branch',
        website: 'bearing.example.com/contact',
        snippet: 'Same company branch',
        sourceLabel: '公开线索'
      },
      {
        title: '',
        website: '',
        sourceLabel: '公开线索'
      },
      {
        title: 'Home',
        website: 'https://low.example.com',
        sourceLabel: '公开线索',
        score: 20
      }
    ]);

    assert.equal(rows[0].importState.canImport, true);
    assert.equal(rows[0].importState.domain, 'bearing.example.com');
    assert.deepEqual(rows[1].importState.reasons, ['重复域名']);
    assert.deepEqual(rows[2].importState.reasons, ['缺少公司名', '缺少官网或域名', '候选质量偏低']);
    assert.deepEqual(rows[3].importState.reasons, ['候选质量偏低']);
  });

  it('builds CRM import payload with AI candidate source snapshot', () => {
    const candidate: Api.AiLeads.LeadSearchCandidateView = {
      title: ' Bearing House ',
      website: ' https://bearing.example.com ',
      snippet: 'Industrial bearing distributor',
      address: 'Riyadh',
      phoneNumber: '+966 123',
      sourceLabel: '公开线索',
      sourceType: 'search',
      sourceUrl: 'https://google.example.com/result',
      score: 88,
      reason: 'Good buyer signal'
    };

    assert.equal(normalizeAiLeadCandidateDomain(candidate), 'bearing.example.com');
    assert.deepEqual(buildAiLeadCandidateImportPayload(candidate, { sourceTaskId: 'task-1' }), {
      name: 'Bearing House',
      websiteUrl: 'https://bearing.example.com',
      customerType: '公开线索',
      sourceTaskId: 'task-1',
      sourceSnapshot: {
        title: 'Bearing House',
        website: 'https://bearing.example.com',
        snippet: 'Industrial bearing distributor',
        address: 'Riyadh',
        phoneNumber: '+966 123',
        sourceType: 'search',
        sourceLabel: '公开线索',
        sourceUrl: 'https://google.example.com/result',
        score: 88,
        reason: 'Good buyer signal'
      }
    });
  });
});
