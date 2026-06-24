import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCrmAiDraftQuality, checkCrmAiPolishCandidate } from './crm-ai-writing-quality-check';

describe('crm-ai-writing-quality-check', () => {
  it('flags AI-ish phrases, long subjects, multiple CTAs, invalid facts, and weak follow-up wording', () => {
    const result = checkCrmAiDraftQuality({
      stepIndex: 2,
      subject: 'A very long subject line that feels like a promotional campaign headline',
      bodyText:
        'I hope this email finds you well. Just checking in. Could you share who handles this, and can we book a call?',
      usedFacts: ['account.name', 'missing.fact'],
      allowedFactIds: ['account.name']
    });

    assert.deepEqual(result.qualityFlags, [
      '发现 AI 味开头或模板句',
      '主题过长，建议控制在 2-6 个词',
      '疑似包含多个 CTA',
      '引用了不存在的 fact id: missing.fact',
      'follow-up 包含无价值跟进句'
    ]);
    assert.equal(result.shouldPolish, true);
  });

  it('rejects polished drafts that introduce new fact ids or a stronger meeting CTA', () => {
    const result = checkCrmAiPolishCandidate({
      base: {
        subject: 'Bearing fit',
        bodyText: 'Would this be relevant?',
        usedFacts: ['account.name']
      },
      polished: {
        subject: 'Bearing supply',
        bodyText: 'Can we schedule a meeting this week?',
        usedFacts: ['account.name', 'product_line.certifications']
      }
    });

    assert.equal(result.acceptable, false);
    assert.deepEqual(result.qualityFlags, [
      '润色版新增了首版未使用的 fact id: product_line.certifications',
      '润色版疑似把 CTA 升级为会议邀约'
    ]);
  });
});
