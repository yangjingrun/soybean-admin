import { findPersonaProfile, type PersonaProfile } from './crm-email-template-renderer';
import type { CrmAccountRecord, CrmContactRecord, CrmPersonaMatchInfo, CrmPersonaProfileRecord } from './crm.types';

export type ResolvedPersonaMatch = CrmPersonaMatchInfo & {
  templatePersona: PersonaProfile | null;
};

/** Matches a CRM contact to organization persona profiles, then falls back to built-in profiles. */
export function buildPersonaMatch(
  profiles: CrmPersonaProfileRecord[],
  account: Pick<CrmAccountRecord, 'customerType'>,
  contact: Pick<CrmContactRecord, 'title'>
): ResolvedPersonaMatch {
  const normalizedTitle = contact.title?.trim().toLowerCase() ?? '';
  const normalizedCustomerType = account.customerType?.trim().toLowerCase() ?? '';
  const titleMatchedProfile = findMatchedPersonaProfile(profiles, normalizedTitle, 'titleKeywordsText');

  if (titleMatchedProfile.profile) {
    return toResolvedPersonaMatch(titleMatchedProfile.profile, 'title', [titleMatchedProfile.keyword], null);
  }

  const customerTypeMatchedProfile = findMatchedPersonaProfile(
    profiles,
    normalizedCustomerType,
    'customerTypeKeywordsText'
  );

  if (customerTypeMatchedProfile.profile) {
    return toResolvedPersonaMatch(
      customerTypeMatchedProfile.profile,
      'customer_type',
      [customerTypeMatchedProfile.keyword],
      null
    );
  }

  const defaultProfile = profiles.find(profile => profile.isDefault) ?? null;

  if (defaultProfile) {
    return toResolvedPersonaMatch(defaultProfile, 'default', [], '未命中职位或客户类型关键词，使用默认画像');
  }

  const builtInProfile = findPersonaProfile(contact.title);

  if (builtInProfile) {
    const matchedKeyword = findMatchedBuiltinPersonaKeyword(builtInProfile, normalizedTitle);

    return {
      persona: {
        id: null,
        name: builtInProfile.label,
        source: 'builtin'
      },
      matchMethod: 'builtin',
      matchedKeywords: matchedKeyword ? [matchedKeyword] : [],
      fallbackReason: '未配置或未命中组织画像，使用内置职位画像',
      templatePersona: {
        ...builtInProfile,
        aliases: [...builtInProfile.aliases],
        source: 'built_in'
      }
    };
  }

  return {
    persona: null,
    matchMethod: 'none',
    matchedKeywords: [],
    fallbackReason: '未命中组织画像或内置职位画像，按通用开发信生成',
    templatePersona: null
  };
}

export function toTemplatePersonaProfile(record: CrmPersonaProfileRecord): PersonaProfile {
  const titleKeywords = splitPersonaKeywords(record.titleKeywordsText);
  const customerTypeKeywords = splitPersonaKeywords(record.customerTypeKeywordsText);
  const focusText = record.focusText || record.painPoints || record.description || record.name;

  return {
    id: record.id,
    label: record.name,
    aliases: [...titleKeywords, ...customerTypeKeywords],
    focusText,
    draftFocusText: focusText,
    painPoints: record.painPoints,
    avoidText: record.avoidText,
    source: 'organization'
  };
}

/** Finds the first profile keyword contained by a normalized CRM field value. */
function findMatchedPersonaProfile(
  profiles: CrmPersonaProfileRecord[],
  normalizedValue: string,
  keywordField: 'titleKeywordsText' | 'customerTypeKeywordsText'
) {
  if (!normalizedValue) {
    return { profile: null, keyword: '' };
  }

  for (const profile of profiles) {
    const keyword = splitPersonaKeywords(profile[keywordField]).find(item =>
      normalizedValue.includes(item.toLowerCase())
    );

    if (keyword) {
      return { profile, keyword };
    }
  }

  return { profile: null, keyword: '' };
}

function toResolvedPersonaMatch(
  profile: CrmPersonaProfileRecord,
  matchMethod: 'title' | 'customer_type' | 'default',
  matchedKeywords: string[],
  fallbackReason: string | null
): ResolvedPersonaMatch {
  return {
    persona: {
      id: profile.id,
      name: profile.name,
      source: 'organization'
    },
    matchMethod,
    matchedKeywords,
    fallbackReason,
    templatePersona: toTemplatePersonaProfile(profile)
  };
}

function findMatchedBuiltinPersonaKeyword(profile: PersonaProfile, normalizedTitle: string) {
  if (!normalizedTitle) {
    return '';
  }

  return profile.aliases.find(alias => normalizedTitle.includes(alias.toLowerCase())) ?? '';
}

/** Splits persisted persona keyword text for lightweight title/customer-type matching. */
function splitPersonaKeywords(value?: string | null) {
  return [
    ...new Set(
      (value ?? '')
        .split(/[\n,，;；]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  ];
}
