import type { CascaderOption } from 'naive-ui';

interface LeadRegionCascaderOption extends CascaderOption {
  label: string;
  value: string;
  keywords: string[];
  children?: LeadRegionCascaderOption[];
}

export const leadRegionCascaderOptions: LeadRegionCascaderOption[] = [
  {
    label: '中国',
    value: 'region:china',
    keywords: ['中国', '中國', 'China', 'CN', 'PRC'],
    children: [
      {
        label: '台湾',
        value: 'region:tw',
        keywords: ['台湾', '臺灣', '台灣', 'Taiwan', 'TW', 'TWN', 'Chinese Taipei', 'Taipei', '台北', '臺北']
      },
      {
        label: '香港',
        value: 'region:hk',
        keywords: ['香港', 'Hong Kong', 'HK', 'HKG']
      },
      {
        label: '澳门',
        value: 'region:mo',
        keywords: ['澳门', '澳門', 'Macao', 'Macau', 'MO', 'MAC']
      }
    ]
  },
  {
    label: '北美',
    value: 'region:north-america',
    keywords: ['北美', 'North America'],
    children: [
      {
        label: '美国',
        value: 'region:us',
        keywords: ['美国', '美國', 'United States', 'USA', 'US', 'U.S.', 'America'],
        children: [
          {
            label: '洛杉矶',
            value: 'region:los-angeles',
            keywords: ['洛杉矶', '洛杉磯', 'Los Angeles', 'LA', 'California', 'CA']
          },
          {
            label: '纽约',
            value: 'region:new-york',
            keywords: ['纽约', '紐約', 'New York', 'NY', 'NYC']
          }
        ]
      },
      {
        label: '加拿大',
        value: 'region:ca',
        keywords: ['加拿大', 'Canada', 'CA']
      }
    ]
  },
  {
    label: '中东',
    value: 'region:middle-east',
    keywords: ['中东', '中東', 'Middle East'],
    children: [
      {
        label: '沙特阿拉伯',
        value: 'region:sa',
        keywords: ['沙特', '沙特阿拉伯', 'Saudi Arabia', 'KSA', 'SA', 'المملكة العربية السعودية']
      },
      {
        label: '阿联酋',
        value: 'region:ae',
        keywords: ['阿联酋', '阿聯酋', 'United Arab Emirates', 'UAE', 'AE', 'Dubai', '迪拜', 'Abu Dhabi']
      }
    ]
  },
  {
    label: '亚洲',
    value: 'region:asia',
    keywords: ['亚洲', '亞洲', 'Asia'],
    children: [
      {
        label: '日本',
        value: 'region:jp',
        keywords: ['日本', 'Japan', 'JP', 'Tokyo', '东京', '東京']
      },
      {
        label: '韩国',
        value: 'region:kr',
        keywords: ['韩国', '韓國', 'Korea', 'South Korea', 'KR', 'Seoul', '首尔', '首爾']
      },
      {
        label: '新加坡',
        value: 'region:sg',
        keywords: ['新加坡', 'Singapore', 'SG']
      }
    ]
  },
  {
    label: '欧洲',
    value: 'region:europe',
    keywords: ['欧洲', '歐洲', 'Europe'],
    children: [
      {
        label: '英国',
        value: 'region:uk',
        keywords: ['英国', '英國', 'United Kingdom', 'UK', 'Great Britain', 'GB', 'Britain', 'England']
      },
      {
        label: '德国',
        value: 'region:de',
        keywords: ['德国', '德國', 'Germany', 'DE', 'Deutschland']
      },
      {
        label: '法国',
        value: 'region:fr',
        keywords: ['法国', '法國', 'France', 'FR']
      }
    ]
  }
];

const regionOptionByValue = new Map<string, LeadRegionCascaderOption>();
const countryLabelByAlias = new Map<string, string>();

collectRegionOptions(leadRegionCascaderOptions);
collectCountryLabels([
  {
    label: '中国',
    aliases: ['中国', '中國', 'China', 'CN', 'PRC']
  },
  {
    label: '台湾',
    aliases: ['台湾', '臺灣', '台灣', 'Taiwan', 'TW', 'TWN', 'Chinese Taipei']
  },
  {
    label: '香港',
    aliases: ['香港', 'Hong Kong', 'HK', 'HKG']
  },
  {
    label: '澳门',
    aliases: ['澳门', '澳門', 'Macao', 'Macau', 'MO', 'MAC']
  },
  {
    label: '美国',
    aliases: ['美国', '美國', 'United States', 'USA', 'US', 'U.S.', 'America']
  },
  {
    label: '加拿大',
    aliases: ['加拿大', 'Canada', 'CA']
  },
  {
    label: '沙特阿拉伯',
    aliases: ['沙特', '沙特阿拉伯', 'Saudi Arabia', 'KSA', 'SA', 'المملكة العربية السعودية']
  },
  {
    label: '阿联酋',
    aliases: ['阿联酋', '阿聯酋', 'United Arab Emirates', 'UAE', 'AE']
  },
  {
    label: '日本',
    aliases: ['日本', 'Japan', 'JP']
  },
  {
    label: '韩国',
    aliases: ['韩国', '韓國', 'Korea', 'South Korea', 'KR']
  },
  {
    label: '新加坡',
    aliases: ['新加坡', 'Singapore', 'SG']
  },
  {
    label: '英国',
    aliases: ['英国', '英國', 'United Kingdom', 'UK', 'Great Britain', 'GB', 'Britain', 'England']
  },
  {
    label: '德国',
    aliases: ['德国', '德國', 'Germany', 'DE', 'Deutschland']
  },
  {
    label: '法国',
    aliases: ['法国', '法國', 'France', 'FR']
  }
]);

/** Match region cascader nodes by label, value and mapped multilingual aliases. */
export function filterLeadRegionOption(pattern: string, option: CascaderOption) {
  const normalizedPattern = normalizeRegionText(pattern);

  if (!normalizedPattern) {
    return true;
  }

  const regionOption = option as LeadRegionCascaderOption;
  const searchItems = [regionOption.label, regionOption.value, ...regionOption.keywords];

  return searchItems.some(item => isFuzzyRegionMatch(item, normalizedPattern));
}

/** Resolve a selected cascader value into backend-searchable region aliases. */
export function getLeadRegionKeywords(value: string) {
  const option = regionOptionByValue.get(value);

  if (!option) {
    return [];
  }

  return Array.from(new Set([option.label, ...option.keywords].map(item => item.trim()).filter(Boolean)));
}

/** Display AI lead country names in Chinese when they match known aliases. */
export function formatLeadCountryDisplay(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return countryLabelByAlias.get(normalizeRegionText(value)) ?? value;
}

function collectRegionOptions(options: LeadRegionCascaderOption[]) {
  options.forEach(option => {
    regionOptionByValue.set(option.value, option);

    if (option.children) {
      collectRegionOptions(option.children);
    }
  });
}

function collectCountryLabels(countries: Array<{ label: string; aliases: string[] }>) {
  countries.forEach(country => {
    country.aliases.forEach(alias => {
      countryLabelByAlias.set(normalizeRegionText(alias), country.label);
    });
  });
}

function normalizeRegionText(value: string) {
  return value.toLowerCase().replace(/[\s._-]+/g, '');
}

function isFuzzyRegionMatch(value: string, normalizedPattern: string) {
  const normalizedValue = normalizeRegionText(value);

  if (normalizedValue.includes(normalizedPattern)) {
    return true;
  }

  let patternIndex = 0;

  for (const char of normalizedValue) {
    if (char === normalizedPattern[patternIndex]) {
      patternIndex += 1;
    }

    if (patternIndex === normalizedPattern.length) {
      return true;
    }
  }

  return false;
}
