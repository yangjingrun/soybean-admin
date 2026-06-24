import { Prisma } from '../../../generated/prisma/client';
import type {
  CrmAccountStatus,
  CrmBlacklistListInput,
  CrmEmailTemplateGroupListInput,
  CrmInboxThreadStatus,
  CrmMailboxStatus,
  CrmMessageStatus,
  CrmPersonaProfileListInput,
  CrmProductLineStatus,
  CrmScheduledMessageStepKind,
  CrmSequenceEnrollmentStatus,
  CrmSequencePolicyListInput,
  CrmSequenceReviewTodoType
} from '../crm.types';
import {
  toAccountKeywordFilter,
  toBlacklistKeywordFilter,
  toEmailTemplateKeywordFilter,
  toInboxThreadKeywordFilter,
  toMailboxKeywordFilter,
  toPersonaProfileKeywordFilter,
  toProductLineKeywordFilter,
  toSequenceEnrollmentKeywordFilter,
  toSequencePolicyKeywordFilter
} from './prisma-crm-keyword-filter.helpers';
import { addCrmBusinessDays, startOfCrmBusinessDay, toDateRange } from './prisma-crm-business-day.helpers';

/** Builds the scoped account identity filter used before detail reads and writes. */
export function toAccountIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmAccountWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped contact identity filter used before contact writes. */
export function toContactIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmContactWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped mailbox identity filter used before mailbox writes. */
export function toMailboxIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmMailboxWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped product line identity filter used before organization-level writes. */
export function toProductLineIdentityWhere(args: {
  id: string;
  organizationId: string;
}): Prisma.CrmProductLineWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId
  };
}

/** Builds the scoped sequence identity filter used before sequence reads and writes. */
export function toSequenceEnrollmentIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmSequenceEnrollmentWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped message identity filter used before draft reads and writes. */
export function toMessageIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmMessageWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped inbox thread identity filter used before inbox detail and writes. */
export function toInboxThreadIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmInboxThreadWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the Prisma account list scope and optional UI filters. */
export function toAccountListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  contactTitle?: string;
  customerType?: string;
  region?: string;
  regionKeywords?: string[];
  status?: CrmAccountStatus;
  sourceTaskId?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
}): Prisma.CrmAccountWhereInput {
  const keywordFilter = args.keyword ? toAccountKeywordFilter(args.keyword) : undefined;
  const regionKeywords = normalizeAccountRegionKeywords(args);
  const regionFilter: Prisma.CrmAccountWhereInput[] | undefined = regionKeywords.length
    ? regionKeywords.flatMap(region => [
        { country: { contains: region, mode: 'insensitive' } },
        { city: { contains: region, mode: 'insensitive' } },
        { address: { contains: region, mode: 'insensitive' } }
      ])
    : undefined;
  const andFilters: Prisma.CrmAccountWhereInput[] = [
    ...(keywordFilter ? [{ OR: keywordFilter }] : []),
    ...(regionFilter ? [{ OR: regionFilter }] : [])
  ];

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.sourceTaskId ? { sourceTaskId: args.sourceTaskId } : {}),
    ...(args.customerType ? { customerType: { contains: args.customerType, mode: 'insensitive' } } : {}),
    ...(args.contactTitle
      ? { contacts: { some: { title: { contains: args.contactTitle, mode: 'insensitive' } } } }
      : {}),
    ...(args.updatedFrom || args.updatedTo
      ? {
          updatedAt: {
            ...(args.updatedFrom ? { gte: args.updatedFrom } : {}),
            ...(args.updatedTo ? { lte: args.updatedTo } : {})
          }
        }
      : {}),
    ...(andFilters.length ? { AND: andFilters } : {})
  };
}

function normalizeAccountRegionKeywords(args: { region?: string; regionKeywords?: string[] }) {
  return Array.from(
    new Set(
      [...(args.regionKeywords ?? []), args.region]
        .map(item => item?.trim())
        .filter((item): item is string => Boolean(item))
    )
  );
}

/** Builds the Prisma mailbox list scope and optional UI filters. */
export function toMailboxListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmMailboxStatus;
}): Prisma.CrmMailboxWhereInput {
  const keywordFilter = args.keyword ? toMailboxKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma product line list scope and optional UI filters. */
export function toProductLineListWhere(args: {
  organizationId: string;
  keyword?: string;
  status?: CrmProductLineStatus;
}): Prisma.CrmProductLineWhereInput {
  const keywordFilter = args.keyword ? toProductLineKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma persona profile list scope and optional UI filters. */
export function toPersonaProfileListWhere(args: CrmPersonaProfileListInput): Prisma.CrmPersonaProfileWhereInput {
  const keywordFilter = args.keyword ? toPersonaProfileKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma email template group list scope and optional UI filters. */
export function toEmailTemplateGroupListWhere(
  args: CrmEmailTemplateGroupListInput
): Prisma.CrmEmailTemplateGroupWhereInput {
  const keywordFilter = args.keyword ? toEmailTemplateKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma sequence policy list scope and optional UI filters. */
export function toSequencePolicyListWhere(args: CrmSequencePolicyListInput): Prisma.CrmSequencePolicyWhereInput {
  const keywordFilter = args.keyword ? toSequencePolicyKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma blacklist list scope and optional UI filters. */
export function toBlacklistListWhere(args: CrmBlacklistListInput): Prisma.CrmBlacklistWhereInput {
  const keywordFilter = args.keyword ? toBlacklistKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

export function toUniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

/** Creates a stable key for organization-scoped blacklist lookups. */
export function toCrmBlacklistPairKey(organizationId: string, emailHash: string) {
  return `${organizationId}:${emailHash}`;
}

export function toScopedOrganizationWhere(args: { organizationId: string; ownerUserId?: string }): {
  organizationId: string;
  ownerUserId?: string;
} {
  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the sequence review list scope and optional UI filters. */
export function toSequenceEnrollmentListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmSequenceEnrollmentStatus;
  todoType?: CrmSequenceReviewTodoType;
  messageStatus?: CrmMessageStatus;
  dateScope?: 'today';
  now?: Date;
}): Prisma.CrmSequenceEnrollmentWhereInput {
  const keywordFilter = args.keyword ? toSequenceEnrollmentKeywordFilter(args.keyword) : undefined;
  const todoTypeFilter = toSequenceEnrollmentTodoTypeWhere(args.todoType);
  const messageFilter = toSequenceEnrollmentMessageWhere(args.messageStatus, args.dateScope, args.now ?? new Date());
  const andFilters = [todoTypeFilter, messageFilter].filter(Boolean) as Prisma.CrmSequenceEnrollmentWhereInput[];

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {})
  };
}

export function toSequenceEnrollmentMessageWhere(
  messageStatus?: CrmMessageStatus,
  dateScope?: 'today',
  now = new Date()
): Prisma.CrmSequenceEnrollmentWhereInput | undefined {
  if (!messageStatus) return undefined;

  const statusWhere: Prisma.CrmMessageWhereInput = {
    status: messageStatus
  };

  if (dateScope === 'today') {
    const todayStart = startOfCrmBusinessDay(now);
    const tomorrowStart = addCrmBusinessDays(todayStart, 1);
    const dateField = messageStatus === 'sent' ? 'sentAt' : 'updatedAt';

    Object.assign(statusWhere, {
      [dateField]: toDateRange(todayStart, tomorrowStart)
    });
  }

  return { messages: { some: statusWhere } };
}

/** Maps sequence review workbench filters to relation-aware Prisma conditions. */
export function toSequenceEnrollmentTodoTypeWhere(
  todoType?: CrmSequenceReviewTodoType
): Prisma.CrmSequenceEnrollmentWhereInput | undefined {
  if (!todoType) return undefined;

  if (todoType === 'draft_review_pending') {
    return { messages: { some: { status: 'draft_pending_review' } } };
  }

  if (todoType === 'follow_up_draft_review') {
    return { messages: { some: { stepIndex: { gt: 1 }, status: 'draft_pending_review' } } };
  }

  if (todoType === 'ready_to_start') {
    return { status: 'ready_to_send', messages: { some: { stepIndex: 1, status: 'draft_ready' } } };
  }

  if (todoType === 'can_generate_next') {
    return {
      status: { in: ['ready_to_send', 'sequence_running'] },
      messages: {
        none: {
          OR: [{ status: { in: ['draft_pending_review', 'queued', 'failed'] } }, { stepIndex: 5 }]
        }
      }
    };
  }

  if (todoType === 'send_failed') {
    return { messages: { some: { status: 'failed' } } };
  }

  return { messages: { some: { stepIndex: 5 } } };
}

/** Builds the inbox thread list scope and optional UI filters. */
export function toInboxThreadListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmInboxThreadStatus;
  mailboxId?: string;
  accountId?: string;
  contactId?: string;
}): Prisma.CrmInboxThreadWhereInput {
  const keywordFilter = args.keyword ? toInboxThreadKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.mailboxId ? { mailboxId: args.mailboxId } : {}),
    ...(args.accountId ? { accountId: args.accountId } : {}),
    ...(args.contactId ? { contactId: args.contactId } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

export function toStepKindWhere(stepKind?: CrmScheduledMessageStepKind): Prisma.CrmMessageWhereInput {
  if (stepKind === 'first_touch') {
    return { stepIndex: 1 };
  }

  if (stepKind === 'follow_up') {
    return { stepIndex: { gt: 1 } };
  }

  return {};
}

export function toStatusWhere<T extends string>(status: T | T[]) {
  return Array.isArray(status) ? { in: status } : status;
}
