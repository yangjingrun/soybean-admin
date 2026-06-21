interface MarketLanguageRule {
  marketName: string;
  languageName: string;
  languageCode: string;
  aliases: string[];
}

interface KeywordPlanWithQueries {
  serperSearchQueries?: SerperQueryLike[];
  serperPlacesQueries?: SerperQueryLike[];
  serperMapsQueries?: SerperQueryLike[];
  marketLanguagePlan?: MarketLanguagePlanItem[];
  searchExecutionRules?: {
    marketLanguagePlan?: MarketLanguagePlanItem[];
  };
}

interface MarketLanguagePlanItem {
  marketName?: unknown;
  languageName?: unknown;
  languageCode?: unknown;
  localQueryRequired?: unknown;
}

interface SerperQueryLike {
  requestBody?: {
    q?: unknown;
    hl?: unknown;
  };
  q?: unknown;
  hl?: unknown;
}

const marketLanguageRules: MarketLanguageRule[] = [
  {
    marketName: '韩国',
    languageName: '韩语',
    languageCode: 'ko',
    aliases: ['韩国', '南韩', 'South Korea', 'Korea', 'Republic of Korea', 'Seoul', 'Busan', 'Incheon']
  },
  {
    marketName: '日本',
    languageName: '日语',
    languageCode: 'ja',
    aliases: ['日本', 'Japan', 'Tokyo', 'Osaka', 'Yokohama', 'Nagoya']
  },
  {
    marketName: '沙特阿拉伯',
    languageName: '阿拉伯语',
    languageCode: 'ar',
    aliases: ['沙特', '沙特阿拉伯', 'Saudi Arabia', 'Riyadh', 'Jeddah', 'Dammam']
  },
  {
    marketName: '阿联酋',
    languageName: '阿拉伯语',
    languageCode: 'ar',
    aliases: ['阿联酋', '迪拜', 'United Arab Emirates', 'UAE', 'Dubai', 'Abu Dhabi', 'Sharjah']
  },
  {
    marketName: '卡塔尔',
    languageName: '阿拉伯语',
    languageCode: 'ar',
    aliases: ['卡塔尔', 'Qatar', 'Doha']
  },
  {
    marketName: '科威特',
    languageName: '阿拉伯语',
    languageCode: 'ar',
    aliases: ['科威特', 'Kuwait']
  },
  {
    marketName: '墨西哥',
    languageName: '西班牙语',
    languageCode: 'es',
    aliases: ['墨西哥', 'Mexico', 'México', 'Mexico City', 'Monterrey', 'Guadalajara']
  },
  {
    marketName: '西班牙',
    languageName: '西班牙语',
    languageCode: 'es',
    aliases: ['西班牙', 'Spain', 'Madrid', 'Barcelona', 'Valencia']
  },
  {
    marketName: '智利',
    languageName: '西班牙语',
    languageCode: 'es',
    aliases: ['智利', 'Chile', 'Santiago']
  },
  {
    marketName: '哥伦比亚',
    languageName: '西班牙语',
    languageCode: 'es',
    aliases: ['哥伦比亚', 'Colombia', 'Bogota', 'Bogotá', 'Medellin', 'Medellín']
  },
  {
    marketName: '巴西',
    languageName: '葡萄牙语',
    languageCode: 'pt',
    aliases: ['巴西', 'Brazil', 'Brasil', 'Sao Paulo', 'São Paulo', 'Rio de Janeiro']
  },
  {
    marketName: '德国',
    languageName: '德语',
    languageCode: 'de',
    aliases: ['德国', 'Germany', 'Deutschland', 'Berlin', 'Hamburg', 'Munich', 'München']
  },
  {
    marketName: '奥地利',
    languageName: '德语',
    languageCode: 'de',
    aliases: ['奥地利', 'Austria', 'Vienna', 'Wien']
  },
  {
    marketName: '法国',
    languageName: '法语',
    languageCode: 'fr',
    aliases: ['法国', 'France', 'Paris', 'Lyon', 'Marseille']
  },
  {
    marketName: '土耳其',
    languageName: '土耳其语',
    languageCode: 'tr',
    aliases: ['土耳其', 'Turkey', 'Türkiye', 'Istanbul', 'Ankara', 'Izmir']
  },
  {
    marketName: '俄罗斯',
    languageName: '俄语',
    languageCode: 'ru',
    aliases: ['俄罗斯', '俄语市场', 'Russia', 'Moscow', 'Saint Petersburg']
  },
  {
    marketName: '泰国',
    languageName: '泰语',
    languageCode: 'th',
    aliases: ['泰国', 'Thailand', 'Bangkok']
  },
  {
    marketName: '越南',
    languageName: '越南语',
    languageCode: 'vi',
    aliases: ['越南', 'Vietnam', 'Ho Chi Minh', 'Hanoi', 'Ha Noi']
  },
  {
    marketName: '意大利',
    languageName: '意大利语',
    languageCode: 'it',
    aliases: ['意大利', 'Italy', 'Italia', 'Milan', 'Milano', 'Rome', 'Roma']
  },
  {
    marketName: '印尼',
    languageName: '印尼语',
    languageCode: 'id',
    aliases: ['印尼', '印度尼西亚', 'Indonesia', 'Jakarta', 'Surabaya']
  }
];

/** Adds market-language requirements that survive saved prompt overrides. */
export function buildKeywordOptimizePrompt(requirement: string) {
  const trimmedRequirement = requirement.trim();
  const detectedRules = detectMarketLanguageRules(trimmedRequirement);
  const marketRulesText = detectedRules.length
    ? `\n已识别目标市场语言：${detectedRules
        .map(rule => `${rule.marketName}=${rule.languageName}，hl=${rule.languageCode}`)
        .join('；')}`
    : '';

  return `${trimmedRequirement}

【目标市场本地语言查询强约束】
你必须先识别目标国家/地区的主要商业语言；如果目标市场主要语言不是英语，Search 和 Places 都必须同时覆盖英文查询和当地语言查询。${marketRulesText}
- searchExecutionRules.marketLanguagePlan 必须输出目标市场语言计划，数组项包含 marketName、languageName、languageCode、localQueryRequired、reason；即使目标市场不在常见国家列表，也要由你根据当地商业环境判断。
- serperSearchQueries：每个非英语目标市场至少输出 2 条当地语言查询，且单一目标市场时，前 6 条 Search 查询中至少出现 1 条当地语言查询。
- serperPlacesQueries：只要输出 Places 查询，每个非英语目标市场至少输出 2 条当地语言本地商家查询。
- 当地语言查询的 requestBody.hl 必须使用对应语言代码，例如 ko、ja、ar、es、pt、de、fr、tr、ru、th、vi、it、id。
- 当地语言查询的 requestBody.q 必须使用当地商业表达里的产品词 + 买家角色词，不能只把英文查询里的国家名或城市名换成当地语言。
- 不要把当地语言查询只放在 Places；Search 必须也有当地语言查询，用于发现本地官网、目录、品牌代理页和 B2B 公司证据。
- 如果查询数量冲突，优先替换低优先级的英文 supplier / general supplier 查询，而不是删除 importer、distributor、dealer、stockist 主线索。`;
}

/** Adds Maps-only keyword requirements inspired by AI_Find_Customer's Google Maps strategy. */
export function buildMapsKeywordOptimizePrompt(requirement: string) {
  return `${requirement.trim()}

【Google Maps 获客强约束】
本次是地图获客模式，只生成 Serper Maps 查询计划，不生成 Search 或 Places 查询。
- serperSearchQueries 必须为空数组。
- serperPlacesQueries 必须为空数组。
- serperMapsQueries 必须包含 5-8 条 Google Maps 搜索词。
- 每条 Maps 关键词必须是 2-5 个词的自然商家搜索短语，像真实用户在 Google Maps 搜框里输入的词。
- 必须覆盖不同维度：本地买家角色 + 城市/区域、商家类别 + 城市/区域、产品 + wholesale/trade、细分应用 + service、本地竞品/市场表达。
- 同一批 serperMapsQueries 内不要重复关键词，也不要只生成同一种维度的关键词。
- 重点找实体商家：distributors、wholesalers、importers、dealers、stockists、industrial suppliers、MRO suppliers、showrooms、retailers、repair services、installers。
- 不要使用 site:、inurl:、复杂 Boolean、引号堆叠或长句。
- 如果用户指定了国家/城市/区域，所有关键词必须围绕这些地区；不要生成未被用户要求的地区。
- 如果目标市场主要商业语言不是英语，必须生成一部分当地语言 Maps 短词，其余可用英语；requestBody.q 不能带中文解释或括号备注。
- requestBody 只允许使用 q、hl、ll、page、placeId、cid；区域扫点优先用 q、hl、ll、page。
- 如果无法确定 ll，经纬度缩放可留空，但 meta.city / meta.reason 必须说明需要用户或后续配置补地图中心点。
- page 默认 1。
- searchExecutionRules.channelPriority 必须为 ["maps"]。
- 不要生成真实客户、邮箱、联系人、电话、地址或示例 lead。
`;
}

/** Builds one repair prompt from validation errors and the previous model output. */
export function buildKeywordOptimizeRepairPrompt(requirement: string, issues: string[], keywordPlan: unknown) {
  return `${requirement.trim()}

【关键词优化结果需要修复】
上一次输出的 JSON 没有通过后端质量门，请只根据下面的问题修复查询计划，并重新输出一个完整合法 JSON 对象。

质量门问题：
${issues.map(issue => `- ${issue}`).join('\n')}

修复要求：
- 保留原有 JSON 顶层结构，不输出 Markdown、解释文字或代码块。
- 必须补齐 searchExecutionRules.marketLanguagePlan，用它声明每个目标市场的 languageCode 和是否需要当地语言查询。
- 必须补齐缺失的当地语言 Search 查询；如果有 Places 查询，也要补齐当地语言 Places 查询。
- requestBody.q 必须是 Serper 可直接执行的查询词，不要加入中文括号备注。
- requestBody.hl 必须与对应当地语言代码一致。
- 不要删除 importer、distributor、dealer、stockist 等主线索，只替换或补充低价值 supplier/general supplier 查询。

上一次输出 JSON：
${JSON.stringify(keywordPlan)}`;
}

/** Validates local-language query coverage for non-English target markets. */
export function validateKeywordPlanLocalLanguages(requirement: string, plan: unknown) {
  if (!plan || typeof plan !== 'object') {
    return [];
  }

  const keywordPlan = plan as KeywordPlanWithQueries;
  const detectedRules = collectValidationRules(requirement, keywordPlan);

  if (!detectedRules.length) {
    return [];
  }

  const searchQueries = keywordPlan.serperSearchQueries ?? [];
  const placesQueries = keywordPlan.serperPlacesQueries ?? [];

  return detectedRules.flatMap(rule => {
    const issues: string[] = [];
    const localSearchCount = countLocalLanguageQueries(searchQueries, rule.languageCode);
    const localSearchInFirstPage = searchQueries
      .slice(0, 6)
      .some(query => isLocalLanguageQuery(query, rule.languageCode));
    const localPlacesCount = countLocalLanguageQueries(placesQueries, rule.languageCode);

    if (localSearchCount < 2) {
      issues.push(`关键词优化结果缺少${rule.marketName}${rule.languageName} Search 查询，至少需要 2 条`);
    }

    if (detectedRules.length === 1 && !localSearchInFirstPage) {
      issues.push(`关键词优化结果前 6 条 Search 查询缺少${rule.marketName}${rule.languageName}查询`);
    }

    if (placesQueries.length > 0 && localPlacesCount < 2) {
      issues.push(`关键词优化结果缺少${rule.marketName}${rule.languageName} Places 查询，至少需要 2 条`);
    }

    return issues;
  });
}

function detectMarketLanguageRules(requirement: string) {
  const normalizedRequirement = requirement.toLowerCase();

  return marketLanguageRules.filter(rule =>
    rule.aliases.some(alias => normalizedRequirement.includes(alias.toLowerCase()))
  );
}

function collectValidationRules(requirement: string, keywordPlan: KeywordPlanWithQueries) {
  const rules = [...detectMarketLanguageRules(requirement), ...readDeclaredMarketLanguageRules(keywordPlan)].filter(
    rule => rule.languageCode !== 'en'
  );
  const seenKeys = new Set<string>();

  return rules.filter(rule => {
    const key = `${rule.marketName}:${rule.languageCode}`;

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);

    return true;
  });
}

function readDeclaredMarketLanguageRules(keywordPlan: KeywordPlanWithQueries): MarketLanguageRule[] {
  const planItems = [
    ...(Array.isArray(keywordPlan.searchExecutionRules?.marketLanguagePlan)
      ? keywordPlan.searchExecutionRules.marketLanguagePlan
      : []),
    ...(Array.isArray(keywordPlan.marketLanguagePlan) ? keywordPlan.marketLanguagePlan : [])
  ];

  return planItems
    .filter(item => item.localQueryRequired !== false)
    .map(item => {
      return {
        marketName: readNonEmptyString(item.marketName),
        languageName: readNonEmptyString(item.languageName),
        languageCode: readNonEmptyString(item.languageCode).toLowerCase(),
        aliases: []
      };
    })
    .filter(rule => rule.marketName && rule.languageName && rule.languageCode);
}

function countLocalLanguageQueries(queries: SerperQueryLike[], languageCode: string) {
  return queries.filter(query => isLocalLanguageQuery(query, languageCode)).length;
}

function isLocalLanguageQuery(query: SerperQueryLike, languageCode: string) {
  return readQueryText(query).length > 0 && readQueryLanguage(query) === languageCode;
}

function readQueryText(query: SerperQueryLike) {
  const value = query.requestBody?.q ?? query.q;

  return typeof value === 'string' ? value.trim() : '';
}

function readQueryLanguage(query: SerperQueryLike) {
  const value = query.requestBody?.hl ?? query.hl;

  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function readNonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
