import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmMessageThreadMode,
  CrmProductLineRecord
} from './crm.types';

export interface PersonaProfile {
  id?: string;
  label: string;
  aliases: string[];
  focusText: string;
  draftFocusText: string;
  painPoints?: string | null;
  avoidText?: string | null;
  source?: 'built_in' | 'organization';
}

export interface TemplateVariable {
  key: string;
  label: string;
  source: string;
}

export interface DefaultTemplateStep {
  stepIndex: number;
  name: string;
  threadMode: CrmMessageThreadMode;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface EmailTemplateRenderOptions {
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  productLine: CrmProductLineRecord | null;
  persona: PersonaProfile | null;
  senderName: string | null;
}

export const personaProfiles: PersonaProfile[] = [
  {
    label: 'Owner / Founder',
    aliases: ['owner', 'founder', 'ceo', 'co-founder', 'general manager', '老板', '创始人'],
    focusText: '利润、增长、差异化、长期合作',
    draftFocusText: 'margin, growth, differentiation, and long-term cooperation'
  },
  {
    label: 'Purchasing Manager',
    aliases: ['purchasing manager', 'buyer', 'procurement manager', 'purchasing officer', '采购', '采购经理'],
    focusText: '价格、MOQ、交期、付款方式',
    draftFocusText: 'price, MOQ, lead time, and payment terms'
  },
  {
    label: 'Sourcing Manager',
    aliases: ['sourcing manager', 'sourcing specialist', 'supplier manager', '供应商开发', '寻源'],
    focusText: '新供应商、样品、认证、风险控制',
    draftFocusText: 'new supplier options, samples, certifications, and risk control'
  },
  {
    label: 'Product Manager',
    aliases: ['product manager', 'product lead', '产品经理'],
    focusText: '产品卖点、设计、功能、上新速度',
    draftFocusText: 'selling points, design, functions, and new-product speed'
  },
  {
    label: 'Category Manager',
    aliases: ['category manager', 'category lead', '品类经理'],
    focusText: 'SKU 补充、毛利、市场趋势',
    draftFocusText: 'SKU expansion, margin, and market trends'
  },
  {
    label: 'Sales Director',
    aliases: ['sales director', 'sales manager', 'head of sales', '销售总监'],
    focusText: '产品是否好卖、渠道接受度',
    draftFocusText: 'sell-through potential and channel acceptance'
  },
  {
    label: 'Project Manager',
    aliases: ['project manager', 'program manager', '项目经理'],
    focusText: '定制、项目节点、交付稳定',
    draftFocusText: 'customization, project milestones, and stable delivery'
  },
  {
    label: 'Operations Manager',
    aliases: ['operations manager', 'operation manager', 'supply chain manager', '运营经理'],
    focusText: '库存、物流、补货效率',
    draftFocusText: 'inventory, logistics, and replenishment efficiency'
  }
];

export const defaultTemplateVariables: TemplateVariable[] = [
  { key: 'account.name', label: '客户公司', source: '线索库' },
  { key: 'account.country', label: '客户国家/地区', source: '线索库' },
  { key: 'contact.name', label: '联系人姓名/职位', source: '联系人' },
  { key: 'product.name', label: '产品线名称', source: '产品资料' },
  { key: 'product.sellingPoint', label: '核心卖点', source: '产品资料' },
  { key: 'product.supplyInfo', label: 'MOQ/交期/认证', source: '产品资料' },
  { key: 'persona.focus', label: '职位画像侧重点', source: '职位/客户画像库' },
  { key: 'persona.painPoints', label: '画像痛点', source: '职位/客户画像库' },
  { key: 'persona.avoidText', label: '避让说明', source: '职位/客户画像库' },
  { key: 'sender.name', label: '发送人姓名', source: '当前用户' }
];

export const defaultTemplateSteps: DefaultTemplateStep[] = [
  {
    stepIndex: 1,
    name: '第 1 封：首封开发信',
    threadMode: 'new_subject',
    delayDays: 0,
    subjectTemplate: '{{product.name}} for {{account.name}}',
    bodyTemplate:
      'Hi {{contact.name}},\n\nI noticed {{account.name}} and thought this might be relevant to your team.\nWe work on {{product.name}}, mainly focused on {{product.sellingPoint}}.\n{{persona.focus}}\n{{product.supplyInfo}}\n\nWould it be useful if I sent a short product list for your review?\n\nBest regards,\n{{sender.name}}'
  },
  {
    stepIndex: 2,
    name: '第 2 封：同线程跟进',
    threadMode: 'same_thread',
    delayDays: 3,
    subjectTemplate: '',
    bodyTemplate:
      'Hi {{contact.name}},\n\nJust following up in case {{product.name}} is relevant for your current sourcing plan.\n\nBest regards,\n{{sender.name}}'
  },
  {
    stepIndex: 3,
    name: '第 3 封：新主题换角度',
    threadMode: 'new_subject',
    delayDays: 7,
    subjectTemplate: 'Quick idea for {{account.name}}',
    bodyTemplate:
      'Hi {{contact.name}},\n\nA quick angle: {{product.sellingPoint}} may help when comparing supplier options.\n\nBest regards,\n{{sender.name}}'
  },
  {
    stepIndex: 4,
    name: '第 4 封：价值补充',
    threadMode: 'new_subject',
    delayDays: 14,
    subjectTemplate: '{{product.name}} supplier option',
    bodyTemplate:
      'Hi {{contact.name}},\n\nSharing one more note in case you are reviewing supplier options for {{product.name}}.\n{{product.supplyInfo}}\n\nBest regards,\n{{sender.name}}'
  },
  {
    stepIndex: 5,
    name: '第 5 封：最后一次触达',
    threadMode: 'new_subject',
    delayDays: 21,
    subjectTemplate: 'Should I close this out?',
    bodyTemplate:
      'Hi {{contact.name}},\n\nI do not want to keep following up if this is not relevant. Should I close this out for now?\n\nBest regards,\n{{sender.name}}'
  }
];

/** Render a CRM email template by replacing supported double-brace variables. */
export function renderEmailTemplateText(template: string, options: EmailTemplateRenderOptions) {
  const replacements = buildEmailTemplateReplacements(options);

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => replacements[key] ?? '');
}

/** Find the closest built-in persona profile for a contact title. */
export function findPersonaProfile(title?: string | null) {
  const normalizedTitle = title?.trim().toLowerCase();
  if (!normalizedTitle) return null;

  return (
    personaProfiles.find(profile =>
      profile.aliases.some(alias => normalizedTitle.includes(alias.toLowerCase()))
    ) ?? null
  );
}

function buildEmailTemplateReplacements(options: EmailTemplateRenderOptions) {
  const { account, contact, persona, productLine, senderName } = options;
  const supplyInfo = [
    productLine?.moq ? `MOQ: ${productLine.moq}` : null,
    productLine?.leadTime ? `lead time: ${productLine.leadTime}` : null,
    productLine?.certifications ? `certifications: ${productLine.certifications}` : null
  ].filter(Boolean);

  const replacements: Record<string, string> = {
    'account.name': account.name,
    'account.country': account.country ?? '',
    'contact.name': contact.fullName || contact.title || 'there',
    'product.name': productLine?.name || 'our product line',
    'product.sellingPoint': productLine?.coreSellingPoints || `supporting ${account.customerType || 'B2B'} customers`,
    'product.supplyInfo': supplyInfo.length ? `For reference, ${supplyInfo.join(', ')}.` : '',
    'persona.focus': persona?.draftFocusText ?? '',
    'persona.painPoints': persona?.painPoints ?? '',
    'persona.avoidText': persona?.avoidText ?? '',
    'sender.name': senderName || 'Sales team'
  };

  return replacements;
}
