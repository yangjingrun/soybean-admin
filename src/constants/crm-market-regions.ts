export interface CrmMarketRegionRow {
  code: string;
  label: string;
  aliases: string[];
  countryCodes: string[];
}

export const crmUnclassifiedMarketRegion: CrmMarketRegionRow = {
  code: 'unclassified',
  label: '未归类市场',
  aliases: ['other market', 'unclassified market'],
  countryCodes: []
};

export const crmMarketRegions: CrmMarketRegionRow[] = [
  {
    code: 'middle_east',
    label: '中东',
    aliases: ['Middle East', 'GCC', 'Gulf market'],
    countryCodes: ['AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'JO', 'IQ', 'IR', 'IL', 'TR', 'YE', 'LB', 'SY', 'PS']
  },
  {
    code: 'europe',
    label: '欧洲',
    aliases: ['Europe', 'European market'],
    countryCodes: [
      'AD',
      'AL',
      'AT',
      'BA',
      'BE',
      'BG',
      'CH',
      'CY',
      'CZ',
      'DE',
      'DK',
      'EE',
      'ES',
      'FI',
      'FR',
      'GB',
      'GR',
      'HR',
      'HU',
      'IE',
      'IS',
      'IT',
      'LI',
      'LT',
      'LU',
      'LV',
      'MC',
      'ME',
      'MK',
      'MT',
      'NL',
      'NO',
      'PL',
      'PT',
      'RO',
      'RS',
      'SE',
      'SI',
      'SK',
      'SM',
      'VA'
    ]
  },
  {
    code: 'north_america',
    label: '北美',
    aliases: ['North America', 'US and Canada'],
    countryCodes: ['US', 'CA']
  },
  {
    code: 'latin_america',
    label: '拉美',
    aliases: ['Latin America', 'LATAM', 'Central America', 'South America'],
    countryCodes: [
      'MX',
      'BR',
      'AR',
      'CL',
      'CO',
      'PE',
      'EC',
      'UY',
      'PY',
      'BO',
      'VE',
      'CR',
      'PA',
      'GT',
      'HN',
      'SV',
      'NI',
      'BZ',
      'DO',
      'CU',
      'JM',
      'TT',
      'PR'
    ]
  },
  {
    code: 'africa',
    label: '非洲',
    aliases: ['Africa', 'African market'],
    countryCodes: [
      'ZA',
      'EG',
      'MA',
      'DZ',
      'TN',
      'LY',
      'NG',
      'KE',
      'ET',
      'GH',
      'TZ',
      'UG',
      'CI',
      'SN',
      'CM',
      'AO',
      'SD',
      'MZ',
      'ZM',
      'ZW',
      'BW',
      'NA',
      'RW',
      'ML',
      'BF',
      'NE'
    ]
  },
  {
    code: 'south_asia',
    label: '南亚',
    aliases: ['South Asia', 'Indian subcontinent'],
    countryCodes: ['IN', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV']
  },
  {
    code: 'southeast_asia',
    label: '东南亚',
    aliases: ['Southeast Asia', 'ASEAN'],
    countryCodes: ['ID', 'MY', 'TH', 'VN', 'PH', 'SG', 'MM', 'KH', 'LA', 'BN', 'TL']
  },
  {
    code: 'east_asia',
    label: '东亚',
    aliases: ['East Asia'],
    countryCodes: ['CN', 'JP', 'KR', 'KP', 'MN', 'TW', 'HK', 'MO']
  },
  {
    code: 'central_asia_cis',
    label: '中亚/CIS',
    aliases: ['Central Asia', 'CIS', 'Commonwealth of Independent States'],
    countryCodes: ['KZ', 'UZ', 'KG', 'TJ', 'TM', 'AZ', 'AM', 'GE', 'RU', 'BY', 'UA', 'MD']
  },
  {
    code: 'oceania',
    label: '大洋洲',
    aliases: ['Oceania', 'Australia and New Zealand'],
    countryCodes: ['AU', 'NZ', 'PG', 'FJ']
  }
];

const marketRegionByCode = new Map(crmMarketRegions.map(region => [region.code, region]));
const marketRegionByCountryCode = new Map(
  crmMarketRegions.flatMap(region => region.countryCodes.map(countryCode => [countryCode, region] as const))
);

/** 按 ISO 国家码找到外贸开发常用市场大区。 */
export function resolveCrmMarketRegionByCountryCode(countryCode: string | null | undefined) {
  const normalizedCode = countryCode?.trim().toUpperCase();

  return normalizedCode ? marketRegionByCountryCode.get(normalizedCode) ?? null : null;
}

/** 按大区编码读取展示名，用于从级联值恢复 AI 上下文。 */
export function resolveCrmMarketRegionByCode(code: string | null | undefined) {
  const normalizedCode = code?.trim();

  return normalizedCode ? marketRegionByCode.get(normalizedCode) ?? null : null;
}
