import type { CrmAccountRecord, CrmContactRecord, CrmMessageThreadMode, CrmProductLineRecord } from './crm.types';
import { crmOutreachStepStrategies } from './crm-outreach-step-strategy';

export interface PersonaProfile {
  id?: string;
  label: string;
  roleKey?: ContactRoleKey;
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

export type ContactRoleKey =
  | 'owner'
  | 'purchasing'
  | 'sourcing'
  | 'product'
  | 'category'
  | 'sales'
  | 'production'
  | 'maintenance'
  | 'project'
  | 'operations';

export const personaProfiles: PersonaProfile[] = [
  {
    label: 'Owner / Founder',
    roleKey: 'owner',
    aliases: [
      'owner',
      'founder',
      'ceo',
      'co-founder',
      'managing director',
      'general director',
      'general manager',
      'president',
      'partner',
      'principal',
      '老板',
      '创始人'
    ],
    focusText: '利润、增长、差异化、长期合作',
    draftFocusText: 'backup supply, cost/risk review, commercial relevance, and long-term cooperation'
  },
  {
    label: 'Purchasing Manager',
    roleKey: 'purchasing',
    aliases: [
      'purchasing manager',
      'purchasing director',
      'purchasing officer',
      'purchase manager',
      'purchase director',
      'procurement manager',
      'procurement director',
      'head of procurement',
      'procurement lead',
      'procurement specialist',
      'buyer',
      'senior buyer',
      'buying manager',
      '采购',
      '采购经理'
    ],
    focusText: '单项比较、MOQ、交期、采购成本、供货条件、备用来源',
    draftFocusText: 'one-item comparison, MOQ, lead time, purchasing conditions, and backup supply'
  },
  {
    label: 'Sourcing Manager',
    roleKey: 'sourcing',
    aliases: [
      'sourcing manager',
      'sourcing specialist',
      'strategic sourcing manager',
      'strategic sourcing',
      'supplier manager',
      'supplier development manager',
      'supplier development specialist',
      'supplier quality',
      'supplier development engineer',
      'vendor manager',
      'vendor development manager',
      'supply base manager',
      '供应商开发',
      '寻源'
    ],
    focusText: '新供应商、样品、检验、风险控制、合规资料、供应商资格',
    draftFocusText: 'supplier qualification, sample route, inspection, risk control, and compliance documents'
  },
  {
    label: 'Product Manager',
    roleKey: 'product',
    aliases: [
      'product manager',
      'product lead',
      'product development manager',
      'r&d manager',
      'design manager',
      '产品经理'
    ],
    focusText: '产品卖点、设计、包装、新品、功能、产品线补充',
    draftFocusText: 'selling points, design, packaging, new items, functions, and product range gaps'
  },
  {
    label: 'Category Manager',
    roleKey: 'category',
    aliases: [
      'category manager',
      'category lead',
      'category buyer',
      'commodity manager',
      'commodity buyer',
      'merchandiser',
      'merchandising manager',
      'assortment manager',
      'range manager',
      '品类经理'
    ],
    focusText: '系列覆盖、SKU、毛利、品类补充、品类评审',
    draftFocusText: 'SKU coverage, series coverage, margin, category gaps, and range review'
  },
  {
    label: 'Sales Director',
    roleKey: 'sales',
    aliases: [
      'sales director',
      'sales manager',
      'head of sales',
      'commercial director',
      'commercial manager',
      'business development manager',
      'bd manager',
      'export manager',
      'key account manager',
      'account manager',
      '销售总监'
    ],
    focusText: '客户询价、报价支持、替换匹配、可售覆盖',
    draftFocusText: 'customer inquiry support, quotation support, cross-reference, and sellable range coverage'
  },
  {
    label: 'Production Manager',
    roleKey: 'production',
    aliases: [
      'production manager',
      'manufacturing manager',
      'plant manager',
      'factory manager',
      'workshop manager',
      'engineering manager',
      'engineer',
      'technical manager',
      'quality manager',
      'qa manager',
      'qc manager',
      '生产经理',
      '制造经理'
    ],
    focusText: '生产连续性、编号/规格核对、配置确认、验证路径',
    draftFocusText:
      'production continuity, designation/specification checks, configuration confirmation, and validation route'
  },
  {
    label: 'Maintenance Manager',
    roleKey: 'maintenance',
    aliases: [
      'maintenance manager',
      'maintenance lead',
      'maintenance supervisor',
      'plant maintenance manager',
      'mro manager',
      'mro buyer',
      'reliability manager',
      'repair manager',
      'service manager',
      'after-sales manager',
      'technical service manager',
      '维修经理',
      '维护经理'
    ],
    focusText: '停机风险、替换匹配、cross-reference、紧急备件、备用来源',
    draftFocusText: 'downtime risk, replacement matching, cross-reference, urgent spares, and backup supply'
  },
  {
    label: 'Project Manager',
    roleKey: 'project',
    aliases: [
      'project manager',
      'program manager',
      'programme manager',
      'project lead',
      'project coordinator',
      '项目经理'
    ],
    focusText: '规格核对、样品验证、交付节点、项目配合',
    draftFocusText: 'specification checks, sample validation, delivery milestones, and project coordination'
  },
  {
    label: 'Operations Manager',
    roleKey: 'operations',
    aliases: [
      'operations manager',
      'operation manager',
      'supply chain manager',
      'supply chain lead',
      'logistics manager',
      'inventory manager',
      'warehouse manager',
      'fulfillment manager',
      'replenishment manager',
      'demand planning manager',
      'demand planner',
      '运营经理'
    ],
    focusText: '补货、物流、供应连续性、包装标签、交付效率',
    draftFocusText: 'replenishment, logistics, supply continuity, packaging or labeling, and delivery efficiency'
  }
];

export const defaultTemplateVariables: TemplateVariable[] = [
  { key: 'account.name', label: '客户公司', source: '线索库' },
  { key: 'account.country', label: '客户国家/地区', source: '线索库' },
  { key: 'account.location', label: '客户地区短语', source: '线索库' },
  { key: 'account.customerType', label: '客户类型', source: '线索库' },
  { key: 'contact.name', label: '联系人姓名/职位', source: '联系人' },
  { key: 'contact.title', label: '联系人职位', source: '联系人' },
  { key: 'contact.workContext', label: '职位工作场景', source: '联系人' },
  { key: 'contact.firstTouchScenario', label: '首封职位场景', source: '联系人' },
  { key: 'contact.choiceOptions', label: '第 4 封岗位选择题', source: '联系人' },
  { key: 'contact.futureTrigger', label: '第 5 封未来触发点', source: '联系人' },
  { key: 'product.name', label: '产品线名称', source: '产品资料' },
  { key: 'product.sellingPoint', label: '核心卖点', source: '产品资料' },
  { key: 'product.supplyInfo', label: 'MOQ/交期/认证', source: '产品资料' },
  { key: 'product.modelInfo', label: '型号/系列', source: '产品资料' },
  { key: 'product.modelSample', label: '型号/系列简短示例', source: '产品资料' },
  { key: 'product.applicationInfo', label: '应用场景', source: '产品资料' },
  { key: 'product.certificationInfo', label: '认证/质量资料', source: '产品资料' },
  { key: 'product.trialOrderInfo', label: '试单信息', source: '产品资料' },
  { key: 'persona.focus', label: '职位画像侧重点', source: '职位/客户画像库' },
  { key: 'persona.painPoints', label: '画像痛点', source: '职位/客户画像库' },
  { key: 'persona.avoidText', label: '避让说明', source: '职位/客户画像库' },
  { key: 'sender.name', label: '发送人姓名', source: '当前用户' }
];

export const defaultTemplateSteps: DefaultTemplateStep[] = crmOutreachStepStrategies.map(step => ({
  stepIndex: step.stepIndex,
  name: step.name,
  threadMode: step.threadMode,
  delayDays: step.defaultDelayDays,
  subjectTemplate: step.subjectTemplate,
  bodyTemplate: step.bodyTemplate
}));

const contactRoleMatchers: Array<{ roleKey: ContactRoleKey; patterns: RegExp[] }> = [
  {
    roleKey: 'maintenance',
    patterns: [
      /\bmro\b/,
      /\bmaintenance\b/,
      /\brepair\b/,
      /\bplant maintenance\b/,
      /\btechnical service\b/,
      /\bafter sales\b/,
      /\bafter-sales\b/
    ]
  },
  {
    roleKey: 'category',
    patterns: [/\bcategory\b/, /\bcommodity\b/, /\bmerchandis(?:er|ing)\b/, /\bassortment\b/, /\brange manager\b/]
  },
  {
    roleKey: 'sourcing',
    patterns: [
      /\bsourcing\b/,
      /\bstrategic sourcing\b/,
      /\bsupplier development\b/,
      /\bsupplier quality\b/,
      /\bsupplier manager\b/,
      /\bvendor\b/,
      /\bsupply base\b/
    ]
  },
  {
    roleKey: 'purchasing',
    patterns: [/\bprocurement\b/, /\bpurchasing\b/, /\bpurchase\b/, /\bbuyer\b/, /\bbuying\b/]
  },
  {
    roleKey: 'operations',
    patterns: [
      /\boperations?\b/,
      /\bsupply chain\b/,
      /\blogistics\b/,
      /\binventory\b/,
      /\bwarehouse\b/,
      /\bfulfillment\b/,
      /\breplenishment\b/,
      /\bdemand planning\b/
    ]
  },
  {
    roleKey: 'owner',
    patterns: [
      /\bowner\b/,
      /\bfounder\b/,
      /\bco founder\b/,
      /\bceo\b/,
      /\bchief executive\b/,
      /\bmanaging director\b/,
      /\bgeneral director\b/,
      /\bgeneral manager\b/,
      /\bpresident\b/,
      /\bpartner\b/,
      /\bprincipal\b/
    ]
  },
  {
    roleKey: 'product',
    patterns: [/\bproduct\b/, /\bproduct development\b/, /\br&d\b/, /\bdesign manager\b/]
  },
  {
    roleKey: 'sales',
    patterns: [
      /\bsales\b/,
      /\bbusiness development\b/,
      /\bbd manager\b/,
      /\bcommercial\b/,
      /\bexport manager\b/,
      /\bkey account\b/,
      /\baccount manager\b/
    ]
  },
  {
    roleKey: 'production',
    patterns: [
      /\bproduction\b/,
      /\bmanufacturing\b/,
      /\bplant manager\b/,
      /\bfactory\b/,
      /\bworkshop\b/,
      /\bengineering manager\b/,
      /\bengineer\b/,
      /\btechnical manager\b/,
      /\bquality\b/,
      /\bqa\b/,
      /\bqc\b/
    ]
  },
  {
    roleKey: 'project',
    patterns: [/\bproject\b/, /\bprogram\b/, /\bprogramme\b/]
  }
];

/** Render a CRM email template by replacing supported double-brace variables. */
export function renderEmailTemplateText(template: string, options: EmailTemplateRenderOptions) {
  const replacements = buildEmailTemplateReplacements(options);

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => replacements[key] ?? '');
}

/** Normalizes noisy real-world contact titles into the role angle used by outreach writing. */
export function normalizeContactRoleKey(title?: string | null): ContactRoleKey | null {
  const normalizedTitle = normalizeContactTitle(title);
  if (!normalizedTitle) return null;

  return (
    contactRoleMatchers.find(matcher => matcher.patterns.some(pattern => pattern.test(normalizedTitle)))?.roleKey ??
    null
  );
}

/** Returns the built-in role label for a real-world contact title. */
export function normalizeContactRoleLabel(title?: string | null) {
  const roleKey = normalizeContactRoleKey(title);
  if (!roleKey) return null;

  return personaProfiles.find(profile => profile.roleKey === roleKey)?.label ?? null;
}

/** Find the closest built-in persona profile for a contact title. */
export function findPersonaProfile(title?: string | null) {
  const roleKey = normalizeContactRoleKey(title);
  if (roleKey) {
    return personaProfiles.find(profile => profile.roleKey === roleKey) ?? null;
  }

  const normalizedTitle = normalizeContactTitle(title);
  if (!normalizedTitle) return null;

  return (
    personaProfiles.find(profile =>
      profile.aliases.some(alias => {
        const normalizedAlias = normalizeContactTitle(alias);

        return Boolean(normalizedAlias && normalizedTitle.includes(normalizedAlias));
      })
    ) ?? null
  );
}

function buildEmailTemplateReplacements(options: EmailTemplateRenderOptions) {
  const { account, contact, persona, productLine, senderName } = options;
  const productModelInfo = getProductModelInfo(productLine);
  const productModelSample = getProductModelSample(productModelInfo);
  const supplyInfo = [
    productLine?.moq ? `MOQ: ${productLine.moq}` : null,
    productLine?.leadTime ? `lead time: ${productLine.leadTime}` : null,
    productLine?.certifications ? `certifications: ${productLine.certifications}` : null
  ].filter(Boolean);

  const replacements: Record<string, string> = {
    'account.name': account.name,
    'account.country': account.country ?? '',
    'account.location': formatAccountLocation(account),
    'account.customerType': account.customerType || 'B2B industrial',
    'contact.name': getContactGreetingName(contact),
    'contact.title': contact.title || '',
    'contact.workContext': getContactWorkContext(contact.title),
    'contact.firstTouchScenario': getFirstTouchScenario(contact.title, productModelSample),
    'contact.choiceOptions': getRoleChoiceOptions(contact.title),
    'contact.futureTrigger': getRoleFutureTrigger(contact.title),
    'product.name': productLine?.name || 'selected products',
    'product.sellingPoint': productLine?.coreSellingPoints || 'regular supply checks',
    'product.supplyInfo': supplyInfo.length ? `For reference, ${supplyInfo.join(', ')}.` : '',
    'product.modelInfo': productModelInfo,
    'product.modelSample': productModelSample,
    'product.applicationInfo': productLine?.targetCustomerType || 'regular industrial applications',
    'product.certificationInfo': productLine?.certifications || 'available quality documents',
    'product.trialOrderInfo': productLine?.moq ? `trial orders from ${productLine.moq}` : 'trial orders',
    'persona.focus': persona?.draftFocusText ?? '',
    'persona.painPoints': persona?.painPoints ?? '',
    'persona.avoidText': persona?.avoidText ?? '',
    'sender.name': senderName || 'Sales team'
  };

  return replacements;
}

function getRoleChoiceOptions(title?: string | null) {
  const roleKey = normalizeContactRoleKey(title);

  if (roleKey === 'purchasing') {
    return formatChoiceOptions(
      'Compare one designation on price, MOQ, or lead time',
      'Check supply availability for one series',
      'Review a trial-quantity route',
      'Another colleague handles bearing purchasing',
      'Not reviewing this now'
    );
  }

  if (roleKey === 'sourcing') {
    return formatChoiceOptions(
      'Review supplier qualification information',
      'Check the sample and inspection process',
      'Confirm required supplier documents',
      'Another colleague handles supplier approval',
      'Not reviewing new suppliers now'
    );
  }

  if (roleKey === 'owner') {
    return formatChoiceOptions(
      'Check whether a backup source is relevant',
      'Compare one representative commercial item',
      'Pass this to the purchasing team',
      'Another colleague handles supplier discussions',
      'Not reviewing this now'
    );
  }

  if (roleKey === 'product') {
    return formatChoiceOptions(
      'Compare one product configuration',
      'Review a range or coverage gap',
      'Check packaging or marking requirements',
      'Another colleague handles product sourcing',
      'Not reviewing the range now'
    );
  }

  if (roleKey === 'category') {
    return formatChoiceOptions(
      'Compare series or range coverage',
      'Check an assortment gap',
      'Review one replenishment or margin question',
      'Another colleague manages this category',
      'Not reviewing the category now'
    );
  }

  if (roleKey === 'sales') {
    return formatChoiceOptions(
      'Cross-reference a customer-requested designation',
      'Check supply coverage for one series',
      'Review one quotation requirement',
      'Another colleague handles sourcing',
      'No current inquiry'
    );
  }

  if (roleKey === 'production') {
    return formatChoiceOptions(
      'Verify one designation or specification',
      'Check dimensions or configuration',
      'Review a sample-validation route',
      'Another colleague handles technical specifications',
      'No current project'
    );
  }

  if (roleKey === 'maintenance') {
    return formatChoiceOptions(
      'Cross-reference a current replacement designation',
      'Check an urgent spare requirement',
      'Keep a backup source for future replacements',
      'Another colleague handles maintenance purchasing',
      'No current requirement'
    );
  }

  if (roleKey === 'project') {
    return formatChoiceOptions(
      'Verify one project designation or specification',
      'Review a sample-validation route',
      'Check one project delivery condition',
      'Another colleague handles project sourcing',
      'No current project'
    );
  }

  if (roleKey === 'operations') {
    return formatChoiceOptions(
      'Check one replenishment requirement',
      'Review packaging or labeling information',
      'Discuss a backup supply route',
      'Another colleague handles this category',
      'No current requirement'
    );
  }

  return [
    'A. Product or designation comparison',
    'B. Supplier qualification',
    'C. Replacement requirement',
    'D. Please redirect me to the relevant colleague',
    'E. Not relevant now'
  ].join('\n');
}

function formatChoiceOptions(optionA: string, optionB: string, optionC: string, optionD: string, optionE: string) {
  return [`A. ${optionA}`, `B. ${optionB}`, `C. ${optionC}`, `D. ${optionD}`, `E. ${optionE}`].join('\n');
}

function getProductModelInfo(productLine: CrmProductLineRecord | null) {
  return normalizeProductModelText(productLine?.commonModelsText?.trim() || productLine?.name || 'selected models');
}

function getProductModelSample(modelInfo: string) {
  const normalized = modelInfo.trim();
  const parts = normalized
    .split(/[;；\n]/)
    .map(item => item.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts.slice(0, 2).join(' and ');

  return normalized.length > 120 ? `${normalized.slice(0, 117).trim()}...` : normalized;
}

function getContactGreetingName(contact: Pick<CrmContactRecord, 'fullName' | 'title'>) {
  const fullName = contact.fullName?.trim();
  if (!fullName) return contact.title || 'there';

  const [firstName] = fullName.split(/\s+/);

  return firstName || fullName;
}

/** Converts common bilingual bearing model notes into English for English default templates. */
function normalizeProductModelText(value: string) {
  return value
    .replace(/[；]/g, '; ')
    .replace(/[，、]/g, ', ')
    .replace(/\s*系列\s*深沟球轴承/g, ' deep groove ball bearings')
    .replace(/\s*系列\s*圆锥滚子轴承/g, ' tapered roller bearings')
    .replace(/\s*系列\s*调心滚子轴承/g, ' spherical roller bearings')
    .replace(/\s*外球面轴承/g, ' mounted insert bearings')
    .replace(/\s*圆柱滚子轴承/g, ' cylindrical roller bearings')
    .replace(/\s*深沟球轴承/g, ' deep groove ball bearings')
    .replace(/\s*圆锥滚子轴承/g, ' tapered roller bearings')
    .replace(/\s*调心滚子轴承/g, ' spherical roller bearings')
    .replace(/\s*系列/g, ' series')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function formatAccountLocation(account: Pick<CrmAccountRecord, 'city' | 'country'>) {
  const location = [account.city, account.country]
    .map(value => value?.trim())
    .filter(Boolean)
    .join(', ');

  return location ? ` in ${location}` : '';
}

function getContactWorkContext(title?: string | null) {
  const roleKey = normalizeContactRoleKey(title);

  if (roleKey === 'purchasing') return 'supplier comparison and purchasing checks';
  if (roleKey === 'sourcing') return 'supplier qualification and sourcing review';
  if (roleKey === 'owner') return 'backup supply and commercial review';
  if (roleKey === 'sales') return 'customer inquiry and quotation support';
  if (roleKey === 'production') return 'specification and production continuity checks';
  if (roleKey === 'maintenance') return 'replacement matching and spare-part planning';
  if (roleKey === 'operations') return 'replenishment and supply-continuity work';
  if (roleKey === 'product' || roleKey === 'category') return 'range coverage and assortment review';
  if (roleKey === 'project') return 'project specification and delivery planning';

  return 'team';
}

function getFirstTouchScenario(title: string | null | undefined, productModelInfo: string) {
  const roleKey = normalizeContactRoleKey(title);

  if (roleKey === 'purchasing') {
    return `When comparing suppliers, the useful first step is often one current item or supply condition to verify. ${productModelInfo} may be relevant if you are reviewing a bearing designation or range.`;
  }

  if (roleKey === 'sourcing') {
    return `If a new source is part of your review, the first check can stay narrow: one product family, one designation, or the supplier qualification route around ${productModelInfo}.`;
  }

  if (roleKey === 'owner') {
    return `If backup supply is worth a quick commercial check, one representative item around ${productModelInfo} is usually enough to judge relevance.`;
  }

  if (roleKey === 'sales') {
    return `When a customer asks for a replacement or quote, the useful first step is often one cross-reference or supply-coverage check.`;
  }

  if (roleKey === 'production') {
    return `For production planning, one designation or configuration check is usually more useful than a broad catalog.`;
  }

  if (roleKey === 'maintenance') {
    return `For maintenance work, the useful first step is often cross-referencing one current replacement designation or spare-part requirement.`;
  }

  if (roleKey === 'operations') {
    return `For replenishment planning, one current item or supply condition is usually easier to check than a full range.`;
  }

  if (roleKey === 'product' || roleKey === 'category') {
    return `For range review, one series, designation group, or assortment gap around ${productModelInfo} may be worth comparing first.`;
  }

  if (roleKey === 'project') {
    return `For project work, one designation, specification, or sample-validation route around ${productModelInfo} is usually the cleanest first check.`;
  }

  return `If your team is checking supply options for ${productModelInfo}, one current item or replacement question may be enough to judge relevance.`;
}

function getRoleFutureTrigger(title?: string | null) {
  const roleKey = normalizeContactRoleKey(title);

  if (roleKey === 'purchasing') return 'price, MOQ, lead-time, or supplier comparison review';
  if (roleKey === 'sourcing') return 'supplier qualification or sourcing review';
  if (roleKey === 'owner') return 'supplier cost or risk review';
  if (roleKey === 'sales') return 'customer inquiry or quotation request';
  if (roleKey === 'production') return 'specification or production requirement';
  if (roleKey === 'maintenance') return 'replacement requirement or maintenance period';
  if (roleKey === 'operations') return 'replenishment cycle or supply review';
  if (roleKey === 'product') return 'product-planning or range review';
  if (roleKey === 'category') return 'assortment or category review';
  if (roleKey === 'project') return 'project or specification review';

  return 'supplier or product review';
}

function normalizeContactTitle(value?: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[._/+-]+/g, ' ')
    .replace(/\s+/g, ' ');
}
