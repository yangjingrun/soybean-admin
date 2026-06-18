interface MarketLanguageRule {
  marketName: string;
  languageName: string;
  languageCode: string;
  aliases: string[];
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
- serperSearchQueries：每个非英语目标市场至少输出 2 条当地语言查询，且单一目标市场时，前 6 条 Search 查询中至少出现 1 条当地语言查询。
- serperPlacesQueries：只要输出 Places 查询，每个非英语目标市场至少输出 2 条当地语言本地商家查询。
- 当地语言查询的 requestBody.hl 必须使用对应语言代码，例如 ko、ja、ar、es、pt、de、fr、tr、ru、th、vi、it、id。
- 当地语言查询的 requestBody.q 必须使用当地商业表达里的产品词 + 买家角色词，不能只把英文查询里的国家名或城市名换成当地语言。
- 不要把当地语言查询只放在 Places；Search 必须也有当地语言查询，用于发现本地官网、目录、品牌代理页和 B2B 公司证据。
- 如果查询数量冲突，优先替换低优先级的英文 supplier / general supplier 查询，而不是删除 importer、distributor、dealer、stockist 主线索。`;
}

function detectMarketLanguageRules(requirement: string) {
  const normalizedRequirement = requirement.toLowerCase();

  return marketLanguageRules.filter(rule =>
    rule.aliases.some(alias => normalizedRequirement.includes(alias.toLowerCase()))
  );
}
