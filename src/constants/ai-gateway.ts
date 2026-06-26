export const aiPromptOptions = [
  {
    label: '关键词优化',
    value: 'lead_keyword_optimize',
    usage: 'AI获客第一步，将自然语言获客需求优化成 Serper Search / Places 查询包。'
  },
  {
    label: '地图关键词优化',
    value: 'lead_maps_keyword_optimize',
    usage: 'AI获客地图模式，将自然语言获客需求优化成 Serper Maps 查询包。'
  },
  {
    label: '搜索结果决策',
    value: 'lead_search_result_decide',
    usage: 'AI获客搜索中间步骤，根据 Serper Search / Places / Maps 结果判断翻页、重搜、切换通道或停止。'
  },
  {
    label: '匹配分析',
    value: 'lead_match_analyze',
    usage: 'AI获客后续步骤，判断线索是否匹配并给出原因和风险。'
  },
  {
    label: '开发信生成',
    value: 'lead_email_generate',
    usage: 'AI获客后续步骤，根据客户证据生成开发信。'
  },
  {
    label: 'CRM 开发信基础规则',
    value: 'crm_outreach_base_rules',
    usage: 'CRM 写信方法论：定义事实边界、个性化原则、单 CTA 和人工审核要求。'
  },
  {
    label: '冷邮件核心方法',
    value: 'crm_outreach_cold_email_core',
    usage: 'CRM 写信方法论：吸收冷邮件相关性、短邮件和低摩擦 CTA 原则。'
  },
  {
    label: '序列跟进策略',
    value: 'crm_outreach_sequence_strategy',
    usage: 'CRM 写信方法论：定义 1-5 封开发信的角度、同线程跟进和每封新增价值。'
  },
  {
    label: '职位画像',
    value: 'crm_outreach_role_persona',
    usage: 'CRM 写信方法论：根据联系人职位选择沟通角度。'
  },
  {
    label: '地区本地化',
    value: 'crm_outreach_region_localization',
    usage: 'CRM 写信方法论：根据国家、城市、时区和语言策略调整表达。'
  },
  {
    label: '公开资料事实约束',
    value: 'crm_outreach_public_source_grounding',
    usage: 'CRM 写信方法论：只使用 CRM 和公开来源已提供事实。'
  },
  {
    label: '主题行规则',
    value: 'crm_outreach_subject_line',
    usage: 'CRM 写信方法论：生成短、自然、低垃圾邮件风险的主题行。'
  },
  {
    label: '送达率保护',
    value: 'crm_outreach_deliverability_guard',
    usage: 'CRM 写信方法论：避免 spam/clickbait、高压销售和无价值跟进语句。'
  },
  {
    label: 'AI 味润色',
    value: 'crm_outreach_ai_polish',
    usage: 'CRM 写信方法论：只做最小表达润色，不新增事实、承诺或 CTA。'
  },
  {
    label: '输出结构契约',
    value: 'crm_outreach_output_contract',
    usage: 'CRM 写信方法论：约束模型只输出严格 JSON。'
  },
  {
    label: '通用模板第 1 封：相关性与初始价值',
    value: 'crm_outreach_general_step_1_relevance',
    usage: 'CRM 通用模板：首封建立客户、职位、产品之间的相关性，并给出一个低摩擦下一步。'
  },
  {
    label: '通用模板第 2 封：具体产品或采购判断',
    value: 'crm_outreach_general_step_2_decision',
    usage: 'CRM 通用模板：第二封推进一个具体产品、技术或采购判断对象，避免泛泛发目录。'
  },
  {
    label: '通用模板第 3 封：采购风险与验证路径',
    value: 'crm_outreach_general_step_3_risk_validation',
    usage: 'CRM 通用模板：第三封围绕一个采购风险或验证路径展开，只使用已发布事实。'
  },
  {
    label: '通用模板第 4 封：选择题跟进',
    value: 'crm_outreach_general_step_4_choice_followup',
    usage: 'CRM 通用模板：第四封用岗位化 A/B/C/D/E 选择题降低回复成本。'
  },
  {
    label: '通用模板第 5 封：轻退出与未来入口',
    value: 'crm_outreach_general_step_5_light_exit',
    usage: 'CRM 通用模板：第五封礼貌结束本轮自动序列，只保留关闭、转介绍或未来触发点。'
  }
] as const;

export type AiPromptKey = (typeof aiPromptOptions)[number]['value'];

export const defaultAiPromptKey: AiPromptKey = 'lead_keyword_optimize';

export const defaultAiModelConfigKey = 'default';
export const defaultSerperConfigKey = 'default';
export const defaultHunterConfigKey = 'default';

export const leadKeywordOptimizePromptKey: AiPromptKey = 'lead_keyword_optimize';
export const leadMapsKeywordOptimizePromptKey: AiPromptKey = 'lead_maps_keyword_optimize';
