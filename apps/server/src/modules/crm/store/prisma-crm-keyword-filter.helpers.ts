import { Prisma } from '../../../generated/prisma/client';

/** Builds account keyword filters for list search. */
export function toAccountKeywordFilter(keyword: string): Prisma.CrmAccountWhereInput[] {
  return ['name', 'domain', 'websiteUrl', 'country', 'customerType'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds mailbox keyword filters for list search. */
export function toMailboxKeywordFilter(keyword: string): Prisma.CrmMailboxWhereInput[] {
  return ['emailAddress', 'maskedEmail', 'ownerUserName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds product-line keyword filters for list search. */
export function toProductLineKeywordFilter(keyword: string): Prisma.CrmProductLineWhereInput[] {
  return [
    'name',
    'targetCustomerType',
    'coreSellingPoints',
    'moq',
    'leadTime',
    'paymentTerms',
    'certifications',
    'commonModelsText'
  ].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds persona-profile keyword filters for list search. */
export function toPersonaProfileKeywordFilter(keyword: string): Prisma.CrmPersonaProfileWhereInput[] {
  return [
    'name',
    'description',
    'titleKeywordsText',
    'customerTypeKeywordsText',
    'painPoints',
    'focusText',
    'avoidText'
  ].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds email-template keyword filters for list search. */
export function toEmailTemplateKeywordFilter(keyword: string): Prisma.CrmEmailTemplateGroupWhereInput[] {
  return ['name', 'description'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds sequence-policy keyword filters for list search. */
export function toSequencePolicyKeywordFilter(keyword: string): Prisma.CrmSequencePolicyWhereInput[] {
  return ['name', 'description'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds blacklist keyword filters for list search. */
export function toBlacklistKeywordFilter(keyword: string): Prisma.CrmBlacklistWhereInput[] {
  return ['maskedEmail', 'createdByName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

/** Builds sequence review keyword filters across enrollment, account, and contact. */
export function toSequenceEnrollmentKeywordFilter(keyword: string): Prisma.CrmSequenceEnrollmentWhereInput[] {
  return [
    { name: { contains: keyword, mode: 'insensitive' } },
    { account: { name: { contains: keyword, mode: 'insensitive' } } },
    { account: { domain: { contains: keyword, mode: 'insensitive' } } },
    { contact: { fullName: { contains: keyword, mode: 'insensitive' } } },
    { contact: { title: { contains: keyword, mode: 'insensitive' } } },
    { contact: { maskedEmail: { contains: keyword, mode: 'insensitive' } } }
  ];
}

/** Builds inbox thread keyword filters across subject, account, and contact. */
export function toInboxThreadKeywordFilter(keyword: string): Prisma.CrmInboxThreadWhereInput[] {
  return [
    { subject: { contains: keyword, mode: 'insensitive' } },
    { account: { name: { contains: keyword, mode: 'insensitive' } } },
    { account: { domain: { contains: keyword, mode: 'insensitive' } } },
    { contact: { fullName: { contains: keyword, mode: 'insensitive' } } },
    { contact: { title: { contains: keyword, mode: 'insensitive' } } },
    { contact: { maskedEmail: { contains: keyword, mode: 'insensitive' } } }
  ];
}
