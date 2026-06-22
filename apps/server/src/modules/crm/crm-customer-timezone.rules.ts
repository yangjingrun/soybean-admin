interface CrmCustomerTimeZoneInput {
  country?: string | null;
  city?: string | null;
}

interface CountryTimeZoneRule {
  aliases: string[];
  cities: Record<string, string>;
  defaultTimeZone: string | null;
}

const countryRules: Record<string, CountryTimeZoneRule> = {
  US: {
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
    aliases: ['ae', 'uae', 'united arab emirates'],
    cities: {
      dubai: 'Asia/Dubai'
    },
    defaultTimeZone: 'Asia/Dubai'
  },
  SA: {
    aliases: ['sa', 'saudi arabia', 'kingdom of saudi arabia', 'ksa'],
    cities: {
      riyadh: 'Asia/Riyadh',
      jeddah: 'Asia/Riyadh'
    },
    defaultTimeZone: 'Asia/Riyadh'
  },
  GB: {
    aliases: ['gb', 'uk', 'united kingdom', 'great britain', 'england'],
    cities: {
      london: 'Europe/London'
    },
    defaultTimeZone: 'Europe/London'
  },
  DE: {
    aliases: ['de', 'germany', 'deutschland'],
    cities: {
      berlin: 'Europe/Berlin'
    },
    defaultTimeZone: 'Europe/Berlin'
  },
  FR: {
    aliases: ['fr', 'france'],
    cities: {
      paris: 'Europe/Paris'
    },
    defaultTimeZone: 'Europe/Paris'
  },
  IN: {
    aliases: ['in', 'india'],
    cities: {
      mumbai: 'Asia/Kolkata',
      delhi: 'Asia/Kolkata',
      'new delhi': 'Asia/Kolkata'
    },
    defaultTimeZone: 'Asia/Kolkata'
  },
  JP: {
    aliases: ['jp', 'japan'],
    cities: {
      tokyo: 'Asia/Tokyo'
    },
    defaultTimeZone: 'Asia/Tokyo'
  },
  KR: {
    aliases: ['kr', 'korea', 'south korea', 'republic of korea'],
    cities: {
      seoul: 'Asia/Seoul'
    },
    defaultTimeZone: 'Asia/Seoul'
  },
  CN: {
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
  const countryRule = countryAliasIndex.get(normalizeRuleKey(input.country));

  if (!countryRule) {
    return null;
  }

  const cityTimeZone = countryRule.cities[normalizeRuleKey(input.city)];

  if (cityTimeZone) {
    return cityTimeZone;
  }

  return countryRule.defaultTimeZone;
}

function normalizeRuleKey(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}
