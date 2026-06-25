import type { CrmAiWritingStepIndex, CrmMessageThreadMode } from './crm.types';

export type CrmOutreachStepTaskKey =
  | 'relevance'
  | 'product_decision'
  | 'risk_validation'
  | 'role_choice'
  | 'polite_close';

export interface CrmOutreachStepStrategy {
  stepIndex: CrmAiWritingStepIndex;
  taskKey: CrmOutreachStepTaskKey;
  name: string;
  taskDescription: string;
  newValue: string;
  defaultDelayDays: number;
  threadMode: CrmMessageThreadMode;
  defaultContinuousFollowUp: boolean;
  requiresNewSignal: boolean;
  wordRange: { min: number; max: number };
  requiredFactGroups: string[];
  mustDo: string[];
  mustAvoid: string[];
  ctaInstruction: string;
  selfCheck: string[];
  subjectTemplate: string;
  bodyTemplate: string;
}

export const crmOutreachStepStrategies: CrmOutreachStepStrategy[] = [
  {
    stepIndex: 1,
    taskKey: 'relevance',
    name: '第 1 封：相关性与初始价值',
    taskDescription: 'Day 1：让客户知道你是谁、为什么联系他，以及一个简短相关价值。',
    newValue: '客户相关性 + 职位相关价值 + 低摩擦动作',
    defaultDelayDays: 0,
    threadMode: 'new_subject',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 50, max: 90 },
    requiredFactGroups: ['company_profile', 'contact_profile', 'product_match'],
    mustDo: [
      'Use one account fact, contact role task, or conservative operating scenario to establish relevance.',
      'Mention one specific product, product family, designation, configuration, or supply value from configured facts.',
      'Explain why this contact role might care instead of only saying what the sender sells.',
      'Use one low-friction CTA that can be answered with yes/no or one concrete object.'
    ],
    mustAvoid: [
      'Do not use geography as the main personalization reason.',
      'Do not open with I came across, I found your website, My name is, or a long company introduction.',
      'Do not ask for a meeting, call, demo, attachment download, or website visit.',
      'Do not label the prospect as distributor/importer/stockist.',
      'For bearings, do not default to model, drawing-based matching, or fit as a generic sales word.'
    ],
    ctaInstruction:
      'Choose one CTA type from permission_send, compare_one, micro_input, or confirm_relevance; avoid generic short list CTAs for bearings.',
    selfCheck: [
      'clear relevance hypothesis',
      'role task present',
      '1-2 provided facts only',
      'one CTA only',
      'no generic product list',
      'bearing terminology is consistent'
    ],
    subjectTemplate: '{{product.name}} comparison',
    bodyTemplate:
      'Hi {{contact.name}},\n\n{{contact.firstTouchScenario}}\n\nWe can support {{product.name}} checks around {{product.modelSample}} with {{product.sellingPoint}}.\n\nWould comparing one current item, designation, or supply requirement be relevant?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 2,
    taskKey: 'product_decision',
    name: '第 2 封：具体产品或采购判断',
    taskDescription: 'Day 3-4：不是催客户，而是推进一个具体产品、技术或采购判断。',
    newValue: '一个具体 designation、series、replacement、configuration 或 supply-condition 判断',
    defaultDelayDays: 3,
    threadMode: 'same_thread',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 45, max: 85 },
    requiredFactGroups: ['product_models', 'application_match', 'supply_terms', 'role_specific_comparison'],
    mustDo: [
      'Add one concrete decision object that was not already the main angle in step 1.',
      'Use at most 1-2 configured product facts and turn them into a role-specific buying, sourcing, technical, or range judgment.',
      'Prefer asking the prospect to compare, provide, cross-reference, or confirm one specific object.',
      'For bearings, prefer designation, series coverage, replacement cross-reference, configuration check, availability check, or one purchasing condition.'
    ],
    mustAvoid: [
      'Do not dump full product catalogs, long model lists, or mixed-language model descriptions.',
      'Do not write Did you see my last email, just following up, One useful reference point may be, or the same list CTA from step 1.',
      'Do not ask whether a short model list, 2-3 regular options, brief overview, quick product list, or 3-5 common models would be useful.',
      'Do not make claims about hot-selling items, stock, MOQ, or lead time unless those facts are provided.'
    ],
    ctaInstruction:
      'Use compare_one, micro_input, or confirm_relevance; ask about one designation, one replacement item, one series coverage question, or one supply condition instead of sending another list.',
    selfCheck: [
      'new concrete decision object added',
      'CTA differs from step 1',
      'no generic list or overview CTA',
      '1-2 product facts max',
      'no catalog dump',
      'no unprovided stock/MOQ/lead-time promise',
      'bearing terminology is correct',
      'one CTA only'
    ],
    subjectTemplate: '',
    bodyTemplate:
      'Hi {{contact.name}},\n\nFor the next check, it may be better to compare one specific item instead of sending a wider list.\n\nIf your team handles {{product.modelSample}}, we can compare one designation, replacement item, configuration, or supply condition.\n\nIs there one current designation or requirement you would like us to cross-reference?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 3,
    taskKey: 'risk_validation',
    name: '第 3 封：采购风险与验证路径',
    taskDescription: 'Day 7：降低新供应商、产品匹配或首次采购风险，给出一个验证路径。',
    newValue: '一个明确风险 + 一个验证路径 + 一个验证 CTA',
    defaultDelayDays: 7,
    threadMode: 'same_thread',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 50, max: 90 },
    requiredFactGroups: ['quality_documents', 'certifications', 'proof_assets'],
    mustDo: [
      'Move from product relevance to one risk-control or validation path.',
      'Choose only one main risk such as designation accuracy, dimensional consistency, configuration consistency, sample approval, inspection process, marking, packaging, traceability, qualification documents, trial quantity, pre-shipment verification, or supplier onboarding.',
      'Use only provided proof facts; if proof facts are thin, ask what validation item the prospect normally requires first.',
      'Keep the CTA around validation, sample, inspection, supplier documents, or one minimal technical requirement.'
    ],
    mustAvoid: [
      'Do not invent ISO, CE, customer references, factory scale, test reports, or case studies.',
      'Do not say reliable supplier, good quality, professional factory, or many years of experience as a substitute for concrete risk control.',
      'Do not list sample, ISO, inspection, packaging, photos, MOQ, and case studies all at once.',
      'Do not send another model list or use unsupported equivalent claims.'
    ],
    ctaInstruction:
      'Use proof_review, sample_or_trial, or micro_input; if proof assets are missing, ask which validation item is normally required first.',
    selfCheck: [
      'one risk only',
      'provided proof facts only',
      'no credential stacking',
      'validation CTA',
      'one CTA only',
      'not a repeat of step 2'
    ],
    subjectTemplate: '',
    bodyTemplate:
      'Hi {{contact.name}},\n\nIf risk is the next question, the useful check is usually one verification route before any regular supply discussion.\n\nFor {{product.name}}, that may mean designation accuracy, configuration consistency, sample validation, inspection, packaging or marking, or supplier documents when those facts are available.\n\nWhich is normally required first on your side: a sample, dimensional check, or supplier documents?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 4,
    taskKey: 'role_choice',
    name: '第 4 封：选择题跟进',
    taskDescription: 'Day 12：前几封未回时，用岗位化选择题降低回复门槛，让客户只需回一个字母。',
    newValue: '岗位相关 A/B/C/D/E 选项 + 低压力确认',
    defaultDelayDays: 12,
    threadMode: 'same_thread',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 50, max: 90 },
    requiredFactGroups: ['contact_role', 'product_models', 'role_pain_points'],
    mustDo: [
      'Use a short A/B/C/D/E choice list tailored to the contact title, role action, and industry context.',
      'Make A/B/C three different practical actions, not three versions of sending materials.',
      'Make D a wrong-contact or redirect option.',
      'Make E a not-reviewing-now or no-current-requirement exit.',
      'State that replying with one letter is enough.'
    ],
    mustAvoid: [
      'Do not send another product pitch or full catalog.',
      'Do not ask open-ended questions that require a long reply.',
      'Do not make A/B/C all generic product-list or overview options.',
      'Do not use pressure, guilt, urgency, or breakup language.'
    ],
    ctaInstruction:
      'Use choice_reply with one_letter response mode; A/B/C are different actions, D is redirect, E is not now.',
    selfCheck: [
      'three different role-specific actions present',
      'wrong-contact option present',
      'not-now option present',
      'one-letter reply is enough',
      'no product catalog',
      'not a generic follow-up'
    ],
    subjectTemplate: 'Which direction is more relevant?',
    bodyTemplate:
      'Hi {{contact.name}},\n\nI am not sure which direction is closest to your team right now, so I will keep this to a choice question.\n\nWhich is closer?\n{{contact.choiceOptions}}\n\nA letter is enough, and it helps me avoid sending the wrong information.\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 5,
    taskKey: 'polite_close',
    name: '第 5 封：轻退出与未来入口',
    taskDescription: 'Day 18：礼貌结束本轮自动触达，并保留关闭、转交或未来节点再联系的入口。',
    newValue: '轻退出 + 正确联系人/未来触发点 + 明确停止本轮自动序列',
    defaultDelayDays: 18,
    threadMode: 'new_subject',
    defaultContinuousFollowUp: false,
    requiresNewSignal: false,
    wordRange: { min: 35, max: 65 },
    requiredFactGroups: ['new_trigger_or_cooldown', 'contact_confirmation'],
    mustDo: [
      'Clearly state that this automatic sequence will close if the topic is not current.',
      'Keep the tone polite and pressure-free.',
      'Offer simple choices: close this out, redirect to the right colleague, or reconnect at a role-relevant future trigger.',
      'If there is no reply, do not continue automatic follow-up.'
    ],
    mustAvoid: [
      'Do not use guilt, urgency, last chance, breakup pressure, or fake scarcity.',
      'Do not ask for a meeting or phone call.',
      'Do not continue selling with new product details unless a real new signal exists.',
      'Do not use send a short overview for future reference as the default CTA.'
    ],
    ctaInstruction:
      'Use close_loop, timing_check, or redirect; ask whether to close now, reconnect at the next role-relevant review, or contact the right colleague.',
    selfCheck: [
      'close-loop intent clear',
      'no pressure language',
      'no fake new signal',
      'no generic overview CTA',
      'role-relevant future trigger',
      'signals end of this sequence'
    ],
    subjectTemplate: 'Should I close this out?',
    bodyTemplate:
      'Hi {{contact.name}},\n\nI will close this sequence here if {{product.name}} is not a current priority for your team.\n\nShould I close this for now, or is your next {{contact.futureTrigger}} a better time to reconnect?\n\nIf another colleague handles this, a name or department is enough. No reply is needed if it is not relevant.\n\nBest,\n{{sender.name}}'
  }
];

/** Returns one configured five-step outreach strategy by step index. */
export function getCrmOutreachStepStrategy(stepIndex: number): CrmOutreachStepStrategy {
  const strategy = crmOutreachStepStrategies.find(item => item.stepIndex === stepIndex);

  if (!strategy) {
    throw new Error(`Unsupported CRM outreach step: ${stepIndex}`);
  }

  return strategy;
}

/** Keeps AI draft input coupled only to the current step duty, not to template rendering fields. */
export function toCrmAiStepStrategy(strategy: CrmOutreachStepStrategy) {
  return {
    taskDescription: strategy.taskDescription,
    newValue: strategy.newValue,
    wordRange: strategy.wordRange,
    requiredFactGroups: strategy.requiredFactGroups,
    mustDo: strategy.mustDo,
    mustAvoid: strategy.mustAvoid,
    ctaInstruction: strategy.ctaInstruction,
    selfCheck: strategy.selfCheck
  };
}

const reactivationSignalFields = [
  'recent_trigger',
  'new_product',
  'trade_show',
  'expansion_signal',
  'website_update',
  'visit_signal',
  'manual_new_signal',
  'hiring_signal',
  'purchase_signal'
] as const;

/** Checks whether step five has a real new signal instead of being a default follow-up. */
export function hasCrmOutreachReactivationSignal(sourceSnapshot?: Record<string, unknown> | null) {
  return reactivationSignalFields.some(field => {
    const value = sourceSnapshot?.[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}
