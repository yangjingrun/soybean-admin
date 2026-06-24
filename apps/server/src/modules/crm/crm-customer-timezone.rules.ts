import { resolveMappedCountryCode } from '../../shared/country-name-map';

interface CrmCustomerTimeZoneInput {
  country?: string | null;
  city?: string | null;
}

interface CountryTimeZoneRule {
  code: string;
  aliases: string[];
  cities: Record<string, string>;
  defaultTimeZone: string | null;
}

const countryRules: Record<string, CountryTimeZoneRule> = {
  US: {
    code: 'US',
    aliases: ['us', 'usa', 'united states', 'united states of america'],
    cities: {
      'new york': 'America/New_York',
      'new york city': 'America/New_York',
      nyc: 'America/New_York',
      'los angeles': 'America/Los_Angeles',
      la: 'America/Los_Angeles',
      chicago: 'America/Chicago',
      houston: 'America/Chicago',
      denver: 'America/Denver'
    },
    defaultTimeZone: null
  },
  AE: {
    code: 'AE',
    aliases: ['ae', 'uae', 'united arab emirates'],
    cities: {
      dubai: 'Asia/Dubai'
    },
    defaultTimeZone: 'Asia/Dubai'
  },
  SA: {
    code: 'SA',
    aliases: ['sa', 'saudi arabia', 'kingdom of saudi arabia', 'ksa'],
    cities: {
      riyadh: 'Asia/Riyadh',
      jeddah: 'Asia/Riyadh'
    },
    defaultTimeZone: 'Asia/Riyadh'
  },
  QA: {
    code: 'QA',
    aliases: ['qa', 'qatar'],
    cities: {
      doha: 'Asia/Qatar'
    },
    defaultTimeZone: 'Asia/Qatar'
  },
  KW: {
    code: 'KW',
    aliases: ['kw', 'kuwait'],
    cities: {
      kuwait: 'Asia/Kuwait',
      'kuwait city': 'Asia/Kuwait'
    },
    defaultTimeZone: 'Asia/Kuwait'
  },
  OM: {
    code: 'OM',
    aliases: ['om', 'oman'],
    cities: {
      muscat: 'Asia/Muscat'
    },
    defaultTimeZone: 'Asia/Muscat'
  },
  BH: {
    code: 'BH',
    aliases: ['bh', 'bahrain'],
    cities: {
      manama: 'Asia/Bahrain'
    },
    defaultTimeZone: 'Asia/Bahrain'
  },
  JO: {
    code: 'JO',
    aliases: ['jo', 'jordan'],
    cities: {
      amman: 'Asia/Amman'
    },
    defaultTimeZone: 'Asia/Amman'
  },
  IQ: {
    code: 'IQ',
    aliases: ['iq', 'iraq'],
    cities: {
      baghdad: 'Asia/Baghdad'
    },
    defaultTimeZone: 'Asia/Baghdad'
  },
  GB: {
    code: 'GB',
    aliases: ['gb', 'uk', 'united kingdom', 'great britain', 'england'],
    cities: {
      london: 'Europe/London'
    },
    defaultTimeZone: 'Europe/London'
  },
  DE: {
    code: 'DE',
    aliases: ['de', 'germany', 'deutschland'],
    cities: {
      berlin: 'Europe/Berlin'
    },
    defaultTimeZone: 'Europe/Berlin'
  },
  FR: {
    code: 'FR',
    aliases: ['fr', 'france'],
    cities: {
      paris: 'Europe/Paris'
    },
    defaultTimeZone: 'Europe/Paris'
  },
  IN: {
    code: 'IN',
    aliases: ['in', 'india'],
    cities: {
      mumbai: 'Asia/Kolkata',
      delhi: 'Asia/Kolkata',
      'new delhi': 'Asia/Kolkata'
    },
    defaultTimeZone: 'Asia/Kolkata'
  },
  JP: {
    code: 'JP',
    aliases: ['jp', 'japan'],
    cities: {
      tokyo: 'Asia/Tokyo'
    },
    defaultTimeZone: 'Asia/Tokyo'
  },
  KR: {
    code: 'KR',
    aliases: ['kr', 'korea', 'south korea', 'republic of korea'],
    cities: {
      seoul: 'Asia/Seoul'
    },
    defaultTimeZone: 'Asia/Seoul'
  },
  CN: {
    code: 'CN',
    aliases: ['cn', 'china', 'prc', "people's republic of china"],
    cities: {
      shanghai: 'Asia/Shanghai',
      shenzhen: 'Asia/Shanghai',
      guangzhou: 'Asia/Shanghai',
      beijing: 'Asia/Shanghai'
    },
    defaultTimeZone: 'Asia/Shanghai'
  }
};

const countryAliasIndex = new Map<string, CountryTimeZoneRule>();

for (const rule of Object.values(countryRules)) {
  for (const alias of rule.aliases) {
    countryAliasIndex.set(normalizeRuleKey(alias), rule);
  }
}

/**
 * Resolve a CRM customer's IANA timezone from lightweight local country + city rules.
 *
 * This intentionally uses a small trade-focused mapping and can be replaced later by
 * a GeoNames or latitude/longitude resolver when higher global coverage is needed.
 */
export function resolveCrmCustomerTimeZone(input: CrmCustomerTimeZoneInput) {
  const countryRule = countryAliasIndex.get(normalizeRuleKey(input.country)) ?? resolveCountryRuleByMappedCode(input.country);

  if (!countryRule) {
    return null;
  }

  const cityTimeZone = countryRule.cities[normalizeRuleKey(input.city)];

  if (cityTimeZone) {
    return cityTimeZone;
  }

  return countryRule.defaultTimeZone;
}

/** Resolve supported country aliases into ISO alpha-2 codes for GeoNames lookups. */
export function resolveCrmCustomerCountryCode(country?: string | null) {
  const normalizedCountry = normalizeRuleKey(country);

  if (/^[a-z]{2}$/.test(normalizedCountry)) {
    return normalizedCountry.toUpperCase();
  }

  return countryAliasIndex.get(normalizedCountry)?.code ?? resolveMappedCountryCode(country) ?? null;
}

function resolveCountryRuleByMappedCode(country?: string | null) {
  const mappedCode = resolveMappedCountryCode(country);

  return mappedCode ? countryRules[mappedCode] : undefined;
}

function normalizeRuleKey(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}
