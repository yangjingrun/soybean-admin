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

  it('flags word count, paragraph count, links, emoji, and spam-risk wording', () => {
    const result = checkCrmAiDraftQuality({
      stepIndex: 1,
      subject: 'URGENT BEST PRICE!!!',
      bodyText:
        'Hi Alex,\n\nThis is your last chance 😊. Please visit https://example.com/catalog and book a meeting now.\n\nAlso download our PDF and tell me who handles sourcing?',
      usedFacts: ['account.name'],
      allowedFactIds: ['account.name'],
      stepStrategy: {
        wordRange: { min: 50, max: 100 },
        taskDescription: '建立相关性'
      }
    });

    assert.ok(result.qualityFlags.includes('主题含高风险营销或紧迫表达'));
    assert.ok(result.qualityFlags.includes('工业 B2B 首封默认不使用 Emoji'));
    assert.ok(result.qualityFlags.includes('首封包含链接，建议先获得兴趣再发送资料'));
    assert.ok(result.qualityFlags.includes('疑似包含多个 CTA'));
  });

  it('triggers polish for overlong or over-paragraphed drafts', () => {
    const result = checkCrmAiDraftQuality({
      stepIndex: 2,
      subject: 'Models to compare',
      bodyText: [
        'Hi Alex,',
        'For import comparisons, the closest fit may be common ranges such as 6000, 6200, 6300, 302, 303, 322, 222, 223, UC, UCP, NU, NJ, and NUP bearing models for regular industrial stock.',
        'These models are often used in machinery, motors, pumps, conveyors, agricultural equipment, and auto parts, with MOQ depending on the exact model and stock situation.',
        'Could you send 3-5 regular models to compare?',
        'Best, Alice'
      ].join('\n\n'),
      usedFacts: ['product_line.commonModelsText'],
      allowedFactIds: ['product_line.commonModelsText'],
      stepStrategy: {
        wordRange: { min: 40, max: 50 },
        taskDescription: '具体产品和采购场景'
      }
    });

    assert.ok(result.qualityFlags.some(flag => flag.includes('正文过长')));
    assert.ok(result.qualityFlags.includes('正文段落过多，建议 1-2 个主要短段落'));
    assert.equal(result.shouldPolish, true);
  });

  it('flags direct customer-type label wording for polish', () => {
    const result = checkCrmAiDraftQuality({
      stepIndex: 1,
      subject: 'Bearing supply',
      bodyText:
        'Hi Rafael,\n\nFor distributors, the usual fit is stable stock options and quick quotation on common items.\n\nWould it be useful if I sent a short product list?',
      usedFacts: ['account.customerType'],
      allowedFactIds: ['account.customerType']
    });

    assert.ok(result.qualityFlags.includes('直接把客户类型标签写给客户，建议改成职位相关的采购/供应场景'));
    assert.equal(result.shouldPolish, true);
  });

  it('flags weak discovery or location-based personalization for polish', () => {
    const result = checkCrmAiDraftQuality({
      stepIndex: 1,
      subject: 'Bearing supply',
      bodyText:
        'Hi Aigerim,\n\nAlmaty Motion Supply came up as a company based in Almaty, so I thought this may be relevant.\n\nWould a short product list be useful?',
      usedFacts: ['account.name', 'account.city'],
      allowedFactIds: ['account.name', 'account.city']
    });

    assert.ok(result.qualityFlags.includes('开头个性化较弱，建议改成职位相关的业务场景'));
    assert.equal(result.shouldPolish, true);
  });

  it('flags generic list CTAs and unsafe bearing terminology for polish', () => {
    const result = checkCrmAiDraftQuality({
      stepIndex: 2,
      subject: 'Bearing options',
      bodyText:
        'Hi Alex,\n\nThese bearing models are a good fit and we have stable stock options.\n\nWould a short model list be useful?',
      usedFacts: ['product_line.commonModelsText'],
      allowedFactIds: ['product_line.commonModelsText']
    });

    assert.ok(result.qualityFlags.includes('CTA 疑似使用 generic list/overview，建议改成一个具体判断对象'));
    assert.ok(result.qualityFlags.includes('轴承邮件疑似把标准编号称为 model，建议改成 designation'));
    assert.ok(
      result.qualityFlags.includes('轴承邮件疑似泛化使用 fit，建议改成 relevant、worth comparing 或 supply option')
    );
    assert.ok(result.qualityFlags.includes('轴承邮件疑似写了未验证 stock，建议改成 availability 或 supply coverage'));
    assert.equal(result.shouldPolish, true);
  });
});
