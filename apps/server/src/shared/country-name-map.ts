export interface CountryNameMapRow {
  code: string;
  zhName: string;
  aliases: string[];
}

const countryNameRows: CountryNameMapRow[] = [
  { code: 'CN', zhName: '中国', aliases: ['china', 'prc', "people's republic of china", '中华人民共和国', '中國'] },
  { code: 'TW', zhName: '台湾', aliases: ['taiwan', 'twn', 'chinese taipei', '臺灣', '台灣'] },
  { code: 'HK', zhName: '香港', aliases: ['hong kong', 'hkg'] },
  { code: 'MO', zhName: '澳门', aliases: ['macao', 'macau', 'mac', '澳門'] },
  { code: 'US', zhName: '美国', aliases: ['usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'america', '美國'] },
  { code: 'CA', zhName: '加拿大', aliases: ['canada'] },
  { code: 'MX', zhName: '墨西哥', aliases: ['mexico'] },
  { code: 'BR', zhName: '巴西', aliases: ['brazil'] },
  { code: 'AR', zhName: '阿根廷', aliases: ['argentina'] },
  { code: 'CL', zhName: '智利', aliases: ['chile'] },
  { code: 'CO', zhName: '哥伦比亚', aliases: ['colombia'] },
  { code: 'PE', zhName: '秘鲁', aliases: ['peru'] },
  { code: 'GB', zhName: '英国', aliases: ['uk', 'united kingdom', 'great britain', 'britain', 'england', '英國'] },
  { code: 'DE', zhName: '德国', aliases: ['germany', 'deutschland', '德國'] },
  { code: 'FR', zhName: '法国', aliases: ['france', '法國'] },
  { code: 'IT', zhName: '意大利', aliases: ['italy', 'italia'] },
  { code: 'ES', zhName: '西班牙', aliases: ['spain'] },
  { code: 'PT', zhName: '葡萄牙', aliases: ['portugal'] },
  { code: 'NL', zhName: '荷兰', aliases: ['netherlands', 'holland', 'the netherlands'] },
  { code: 'BE', zhName: '比利时', aliases: ['belgium'] },
  { code: 'CH', zhName: '瑞士', aliases: ['switzerland'] },
  { code: 'AT', zhName: '奥地利', aliases: ['austria'] },
  { code: 'SE', zhName: '瑞典', aliases: ['sweden'] },
  { code: 'NO', zhName: '挪威', aliases: ['norway'] },
  { code: 'DK', zhName: '丹麦', aliases: ['denmark'] },
  { code: 'FI', zhName: '芬兰', aliases: ['finland'] },
  { code: 'PL', zhName: '波兰', aliases: ['poland'] },
  { code: 'CZ', zhName: '捷克', aliases: ['czech republic', 'czechia'] },
  { code: 'RU', zhName: '俄罗斯', aliases: ['russia', 'russian federation'] },
  { code: 'TR', zhName: '土耳其', aliases: ['turkey', 'turkiye', 'türkiye'] },
  { code: 'UA', zhName: '乌克兰', aliases: ['ukraine'] },
  { code: 'GE', zhName: '格鲁吉亚', aliases: ['georgia'] },
  { code: 'SA', zhName: '沙特阿拉伯', aliases: ['saudi arabia', 'kingdom of saudi arabia', 'ksa', '沙特', 'المملكة العربية السعودية'] },
  { code: 'AE', zhName: '阿联酋', aliases: ['uae', 'united arab emirates', 'emirates', '阿聯酋'] },
  { code: 'QA', zhName: '卡塔尔', aliases: ['qatar'] },
  { code: 'KW', zhName: '科威特', aliases: ['kuwait'] },
  { code: 'OM', zhName: '阿曼', aliases: ['oman'] },
  { code: 'BH', zhName: '巴林', aliases: ['bahrain'] },
  { code: 'JO', zhName: '约旦', aliases: ['jordan'] },
  { code: 'IQ', zhName: '伊拉克', aliases: ['iraq'] },
  { code: 'IR', zhName: '伊朗', aliases: ['iran'] },
  { code: 'IL', zhName: '以色列', aliases: ['israel'] },
  { code: 'EG', zhName: '埃及', aliases: ['egypt'] },
  { code: 'ZA', zhName: '南非', aliases: ['south africa'] },
  { code: 'NG', zhName: '尼日利亚', aliases: ['nigeria'] },
  { code: 'KE', zhName: '肯尼亚', aliases: ['kenya'] },
  { code: 'MA', zhName: '摩洛哥', aliases: ['morocco'] },
  { code: 'IN', zhName: '印度', aliases: ['india'] },
  { code: 'PK', zhName: '巴基斯坦', aliases: ['pakistan'] },
  { code: 'BD', zhName: '孟加拉国', aliases: ['bangladesh'] },
  { code: 'LK', zhName: '斯里兰卡', aliases: ['sri lanka'] },
  { code: 'JP', zhName: '日本', aliases: ['japan'] },
  { code: 'KR', zhName: '韩国', aliases: ['korea', 'south korea', 'republic of korea', '韓國'] },
  { code: 'SG', zhName: '新加坡', aliases: ['singapore'] },
  { code: 'MY', zhName: '马来西亚', aliases: ['malaysia'] },
  { code: 'TH', zhName: '泰国', aliases: ['thailand'] },
  { code: 'VN', zhName: '越南', aliases: ['vietnam', 'viet nam'] },
  { code: 'ID', zhName: '印度尼西亚', aliases: ['indonesia'] },
  { code: 'PH', zhName: '菲律宾', aliases: ['philippines'] },
  { code: 'AU', zhName: '澳大利亚', aliases: ['australia'] },
  { code: 'NZ', zhName: '新西兰', aliases: ['new zealand'] }
];

const countryNameByCode = new Map(countryNameRows.map(row => [row.code, row.zhName]));
const countryCodeByAlias = new Map<string, string>();
const countryNameByAlias = new Map<string, string>();

for (const row of countryNameRows) {
  [row.code, row.zhName, ...row.aliases].forEach(alias => {
    const key = normalizeCountryNameKey(alias);
    countryCodeByAlias.set(key, row.code);
    countryNameByAlias.set(key, row.zhName);
  });
}

/** Resolve a country code or known alias into a Chinese display name from the project mapping table. */
export function resolveMappedCountryZhName(value?: string | null) {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  const exactName = countryNameByAlias.get(normalizeCountryNameKey(text));

  if (exactName) {
    return exactName;
  }

  for (const part of readLocationParts(text)) {
    const name = countryNameByAlias.get(normalizeCountryNameKey(part));

    if (name) {
      return name;
    }
  }

  return null;
}

/** Resolve a country code or known alias into ISO alpha-2 when the mapping table knows it. */
export function resolveMappedCountryCode(value?: string | null) {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  const exactCode = countryCodeByAlias.get(normalizeCountryNameKey(text));

  if (exactCode) {
    return exactCode;
  }

  for (const part of readLocationParts(text)) {
    const code = countryCodeByAlias.get(normalizeCountryNameKey(part));

    if (code) {
      return code;
    }
  }

  return null;
}

/** Return a mapped Chinese name for known countries; otherwise keep the original trimmed text. */
export function normalizeCountryToMappedZhName(value?: string | null) {
  const text = value?.trim();

  if (!text) {
    return '';
  }

  return resolveMappedCountryZhName(text) ?? text;
}

/** Return the Chinese country name for one ISO alpha-2 code when present in the explicit map. */
export function getMappedCountryZhNameByCode(countryCode: string) {
  return countryNameByCode.get(countryCode.trim().toUpperCase()) ?? null;
}

function readLocationParts(value: string) {
  return value
    .split(/[,，;；|/]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .reverse();
}

function normalizeCountryNameKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}
