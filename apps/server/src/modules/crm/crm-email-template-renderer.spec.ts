import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmAccountRecord, CrmContactRecord, CrmProductLineRecord } from './crm.types';
import {
  defaultTemplateSteps,
  findPersonaProfile,
  normalizeContactRoleLabel,
  renderEmailTemplateText
} from './crm-email-template-renderer';

describe('crm-email-template-renderer', () => {
  it('renders first-touch copy by role while using only configured model information', () => {
    const firstStep = defaultTemplateSteps.find(step => step.stepIndex === 1);
    assert.ok(firstStep);

    const samples = [
      { title: 'Purchasing Director', expected: /one current item or supply condition/i },
      { title: 'CEO', expected: /backup supply.*commercial check/i },
      { title: 'Sales Director', expected: /customer asks for a replacement or quote/i },
      { title: 'Production Manager', expected: /one designation or configuration check/i },
      { title: 'Maintenance Manager', expected: /cross-referencing one current replacement designation/i },
      { title: 'Operations Manager', expected: /replenishment planning.*one current item/i },
      { title: null, expected: /one current item or replacement question/i }
    ];

    for (const sample of samples) {
      const bodyText = renderEmailTemplateText(firstStep.bodyTemplate, {
        account: createAccount(),
        contact: createContact({ title: sample.title }),
        productLine: createProductLine(),
        persona: findPersonaProfile(sample.title),
        senderName: 'Yangjr'
      });

      assert.match(bodyText, /Hi Rafael,/);
      assert.doesNotMatch(bodyText, /Hi Rafael Costa,/);
      assert.match(bodyText, /6000\/6200\/6300/);
      assert.match(bodyText, /302\/303\/322/);
      assert.doesNotMatch(bodyText, /222\/223/);
      assert.match(bodyText, sample.expected);
      assert.doesNotMatch(
        bodyText,
        /\bFor distributors\b|\bSome distributors\b|\bregular bearing models\b|equivalent options|stock gaps/i
      );
    }
  });

  it('normalizes bilingual bearing model text for English default templates', () => {
    const secondStep = defaultTemplateSteps.find(step => step.stepIndex === 2);
    assert.ok(secondStep);

    const bodyText = renderEmailTemplateText(secondStep.bodyTemplate, {
      account: createAccount(),
      contact: createContact({ fullName: 'Aigerim Nurpeis', title: 'General Manager' }),
      productLine: {
        ...createProductLine(),
        commonModelsText: '6000/6200/6300 系列深沟球轴承；302/303/322 系列圆锥滚子轴承；222/223 系列调心滚子轴承'
      },
      persona: findPersonaProfile('General Manager'),
      senderName: 'Yangjr'
    });

    assert.match(bodyText, /Hi Aigerim,/);
    assert.match(bodyText, /6000\/6200\/6300 deep groove ball bearings/);
    assert.match(bodyText, /302\/303\/322 tapered roller bearings/);
    assert.doesNotMatch(bodyText, /深沟球轴承|圆锥滚子轴承|调心滚子轴承|系列/);
    assert.doesNotMatch(bodyText, /222\/223/);
  });

  it('maps real-world title aliases into stable outreach role angles', () => {
    const samples = [
      ['Head of Procurement', 'Purchasing Manager'],
      ['Category Buyer', 'Category Manager'],
      ['MRO Buyer', 'Maintenance Manager'],
      ['Vendor Manager', 'Sourcing Manager'],
      ['Managing Director', 'Owner / Founder'],
      ['Supply Chain Lead', 'Operations Manager'],
      ['Merchandiser', 'Category Manager'],
      ['Export Manager', 'Sales Director'],
      ['Plant Maintenance Supervisor', 'Maintenance Manager'],
      ['Project Coordinator', 'Project Manager'],
      ['Assortment Manager', 'Category Manager'],
      ['Supplier Development Engineer', 'Sourcing Manager']
    ];

    for (const [title, expectedLabel] of samples) {
      assert.equal(normalizeContactRoleLabel(title), expectedLabel);
      assert.equal(findPersonaProfile(title)?.label, expectedLabel);
    }
  });

  it('uses normalized role aliases for choice-question follow-ups', () => {
    const fourthStep = defaultTemplateSteps.find(step => step.stepIndex === 4);
    assert.ok(fourthStep);

    const bodyText = renderEmailTemplateText(fourthStep.bodyTemplate, {
      account: createAccount(),
      contact: createContact({ title: 'MRO Buyer' }),
      productLine: createProductLine(),
      persona: findPersonaProfile('MRO Buyer'),
      senderName: 'Yangjr'
    });

    assert.match(bodyText, /A\. Cross-reference a current replacement designation/);
    assert.match(bodyText, /B\. Check an urgent spare requirement/);
    assert.match(bodyText, /D\. Another colleague handles maintenance purchasing/);
    assert.match(bodyText, /E\. No current requirement/);
  });
});

function createAccount(): CrmAccountRecord {
  const now = new Date('2026-06-25T00:00:00.000Z');

  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'Brasil Rolamentos Distribuidora',
    normalizedName: 'brasil rolamentos distribuidora',
    websiteUrl: 'https://example.com',
    domain: 'example.com',
    country: 'BR',
    city: 'São Paulo',
    address: null,
    timeZone: 'America/Sao_Paulo',
    customerType: '轴承经销商 / 库存商',
    status: 'candidate',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function createContact(overrides: Partial<CrmContactRecord> = {}): CrmContactRecord {
  const now = new Date('2026-06-25T00:00:00.000Z');

  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Rafael Costa',
    title: 'Purchasing Director',
    email: 'rafael@example.com',
    emailHash: 'email-hash',
    maskedEmail: 'r***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid',
    sourceTaskId: null,
    emailProgressStatus: 'not_generated',
    emailProgressLabel: '未开始',
    emailProgressAt: null,
    emailProgressMessageId: null,
    emailProgressStepIndex: null,
    emailProgressTotalSteps: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createProductLine(): CrmProductLineRecord {
  const now = new Date('2026-06-25T00:00:00.000Z');

  return {
    id: 'line-1',
    organizationId: 'org-1',
    name: '轴承',
    targetCustomerType: '轴承经销商 / 库存商',
    coreSellingPoints: 'OEM/ODM support and model- or drawing-based matching',
    moq: null,
    leadTime: null,
    paymentTerms: null,
    certifications: null,
    catalogUrl: null,
    websiteUrl: null,
    commonModelsText:
      '6000/6200/6300 deep groove ball bearings; 302/303/322 tapered roller bearings; 222/223 spherical roller bearings',
    aiWritingConfig: null,
    status: 'active',
    createdById: 'user-1',
    createdByName: 'Yangjr',
    createdAt: now,
    updatedAt: now
  };
}
