import { Prisma } from '../../../generated/prisma/client';
import type { CrmTimelineEventModel } from '../../../generated/prisma/models/CrmTimelineEvent';
import type {
  CrmAccountStatus,
  CrmAiDraftTaskCreateInput,
  CrmAiDraftTaskItemUpdateInput,
  CrmAiDraftTaskUpdateInput,
  CrmBlacklistListInput,
  CrmMailboxStatus,
  CrmEmailTemplateGroupListInput,
  CrmEmailTemplateStepInput,
  CrmInboxThreadRecord,
  CrmInboxThreadGmailStateSyncInput,
  CrmInboxThreadStatus,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileUpdateInput,
  CrmProductLineStatus,
  CrmSequenceEnrollmentStatus,
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyUpdateInput,
  CrmSequenceReviewTodoType,
  CrmScheduledMessageStepKind,
  CrmStrategyStatDimension,
  CrmStrategyStatRow
} from '../crm.types';
import {
  serializeSequencePolicyStepDelayDays,
  serializeSequencePolicyThreadModes
} from '../crm-sequence-policy';

// Workbench "today" follows the current CRM business day, while quota buckets remain UTC elsewhere.
const crmBusinessDayOffsetMinutes = 8 * 60;

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
export function toProductLineIdentityWhere(args: { id: string; organizationId: string }): Prisma.CrmProductLineWhereInput {
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
  status?: CrmAccountStatus;
}): Prisma.CrmAccountWhereInput {
  const keywordFilter = args.keyword ? toAccountKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
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
export function toEmailTemplateGroupListWhere(args: CrmEmailTemplateGroupListInput): Prisma.CrmEmailTemplateGroupWhereInput {
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

export function toBlacklistListWhere(args: CrmBlacklistListInput): Prisma.CrmBlacklistWhereInput {
  const keywordFilter = args.keyword ? toBlacklistKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

export function toUniqueOwnerPairs(owners: Array<{ organizationId: string; ownerUserId: string }>) {
  return Array.from(
    new Map(owners.map(owner => [toOwnerPairKey(owner.organizationId, owner.ownerUserId), owner])).values()
  );
}

export function toOwnerPairFilters(owners: Array<{ organizationId: string; ownerUserId: string }>) {
  return owners.map(owner => ({
    organizationId: owner.organizationId,
    ownerUserId: owner.ownerUserId
  }));
}

export function toDispatchedMessageRangeWhere(from: Date, to: Date): Prisma.CrmMessageWhereInput {
  return {
    OR: [
      {
        status: 'queued',
        scheduledAt: {
          gte: from,
          lt: to
        }
      },
      {
        status: 'sent',
        sentAt: {
          gte: from,
          lt: to
        }
      }
    ]
  };
}

export function toOwnerPairKey(organizationId: string, ownerUserId: string) {
  return `${organizationId}:${ownerUserId}`;
}

export function toUniqueMailboxPairs(mailboxes: Array<{ organizationId: string; mailboxId: string }>) {
  return Array.from(
    new Map(mailboxes.map(mailbox => [toMailboxPairKey(mailbox.organizationId, mailbox.mailboxId), mailbox])).values()
  );
}

export function toMailboxPairFilters(mailboxes: Array<{ organizationId: string; mailboxId: string }>) {
  return mailboxes.map(mailbox => ({
    organizationId: mailbox.organizationId,
    mailboxId: mailbox.mailboxId
  }));
}

export function toMailboxCountMap(rows: Array<{ organizationId: string; mailboxId: string | null; _count: { _all: number } }>) {
  const result = new Map<string, number>();

  for (const row of rows) {
    if (!row.mailboxId) {
      continue;
    }

    result.set(toMailboxPairKey(row.organizationId, row.mailboxId), row['_count']['_all']);
  }

  return result;
}

export function toMailboxPairKey(organizationId: string, mailboxId: string) {
  return `${organizationId}:${mailboxId}`;
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

export function startOfCrmBusinessDay(date: Date) {
  const shifted = new Date(date.getTime() + crmBusinessDayOffsetMinutes * 60_000);

  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      crmBusinessDayOffsetMinutes * 60_000
  );
}

export function addCrmBusinessDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toDateRange(from: Date, to: Date) {
  return { gte: from, lt: to };
}

export function formatCrmBusinessDateKey(date: Date) {
  return new Date(date.getTime() + crmBusinessDayOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function readProgressPercent(progressState: unknown, status: string) {
  if (status === 'completed' || status === 'failed') return 100;
  if (!progressState || typeof progressState !== 'object' || !('progressPercent' in progressState)) return undefined;

  const value = (progressState as { progressPercent?: unknown }).progressPercent;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function countDates(dates: Date[]) {
  const counts = new Map<string, number>();

  for (const date of dates) {
    const key = formatCrmBusinessDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export function isDate(value: Date | null): value is Date {
  return value instanceof Date;
}

export function createEmptyStrategyRows(): Record<CrmStrategyStatDimension, CrmStrategyStatRow[]> {
  return {
    template: [],
    policy: [],
    persona: [],
    productLine: []
  };
}

export function getOrCreateStrategyStatRow(
  rows: CrmStrategyStatRow[],
  input: { dimension: CrmStrategyStatDimension; key: string; name: string }
) {
  const existing = rows.find(row => row.key === input.key);

  if (existing) return existing;

  const row: CrmStrategyStatRow = {
    dimension: input.dimension,
    key: input.key,
    name: input.name,
    sequenceCount: 0,
    draftPendingCount: 0,
    readyCount: 0,
    queuedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliedCount: 0,
    stoppedCount: 0
  };
  rows.push(row);

  return row;
}

export function applyEnrollmentStat(row: CrmStrategyStatRow, status: CrmSequenceEnrollmentStatus) {
  row.sequenceCount += 1;

  if (status === 'replied') {
    row.repliedCount += 1;
  }

  if (status === 'stopped') {
    row.stoppedCount += 1;
  }
}

export function applyMessageStat(row: CrmStrategyStatRow, status: CrmMessageRecord['status']) {
  if (status === 'draft_pending_review') {
    row.draftPendingCount += 1;
  } else if (status === 'draft_ready') {
    row.readyCount += 1;
  } else if (status === 'queued') {
    row.queuedCount += 1;
  } else if (status === 'sent') {
    row.sentCount += 1;
  } else if (status === 'failed') {
    row.failedCount += 1;
  }
}

export function sortStrategyRows(rows: CrmStrategyStatRow[]) {
  return [...rows].sort((left, right) => {
    if (right.sequenceCount !== left.sequenceCount) return right.sequenceCount - left.sequenceCount;
    return left.name.localeCompare(right.name);
  });
}

export function buildPersonaStatMap(events: CrmTimelineEventModel[]) {
  const result = new Map<string, { key: string; name: string }>();

  for (const event of events) {
    const metadata = event.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue;

    const enrollmentId = (metadata as Record<string, unknown>).enrollmentId;
    if (typeof enrollmentId !== 'string' || result.has(enrollmentId)) continue;

    const personaProfileId = (metadata as Record<string, unknown>).personaProfileId;
    const personaProfileName = (metadata as Record<string, unknown>).personaProfileName;
    result.set(enrollmentId, {
      key: typeof personaProfileId === 'string' && personaProfileId ? personaProfileId : 'unknown',
      name: typeof personaProfileName === 'string' && personaProfileName ? personaProfileName : '未匹配画像'
    });
  }

  return result;
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
}): Prisma.CrmInboxThreadWhereInput {
  const keywordFilter = args.keyword ? toInboxThreadKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.mailboxId ? { mailboxId: args.mailboxId } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

export function toAccountKeywordFilter(keyword: string): Prisma.CrmAccountWhereInput[] {
  return ['name', 'domain', 'websiteUrl', 'country', 'customerType'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

export function toMailboxKeywordFilter(keyword: string): Prisma.CrmMailboxWhereInput[] {
  return ['emailAddress', 'maskedEmail', 'ownerUserName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

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

export function toEmailTemplateKeywordFilter(keyword: string): Prisma.CrmEmailTemplateGroupWhereInput[] {
  return ['name', 'description'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

export function toSequencePolicyKeywordFilter(keyword: string): Prisma.CrmSequencePolicyWhereInput[] {
  return ['name', 'description'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

export function toBlacklistKeywordFilter(keyword: string): Prisma.CrmBlacklistWhereInput[] {
  return ['maskedEmail', 'createdByName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

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

export function toSequenceReviewInclude() {
  return {
    account: true,
    contact: true,
    productLine: true,
    mailbox: true,
    policy: true,
    messages: {
      orderBy: [{ stepIndex: 'asc' as const }, { createdAt: 'asc' as const }]
    }
  };
}

export function toInboxThreadListInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      take: 1,
      orderBy: { receivedAt: 'desc' as const }
    }
  };
}

export function toInboxThreadDetailInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      orderBy: { receivedAt: 'asc' as const }
    }
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

export function toNullableJsonInput(value: unknown) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

export function countAiDraftTaskItems(items: CrmAiDraftTaskCreateInput['items']) {
  return {
    successCount: items.filter(item => item.status === 'succeeded').length,
    skippedCount: items.filter(item => item.status === 'skipped').length,
    failedCount: items.filter(item => item.status === 'failed').length,
    retryingCount: items.filter(item => item.status === 'retrying').length,
    runningCount: items.filter(item => item.status === 'running').length,
    pendingCount: items.filter(item => (item.status ?? 'pending') === 'pending').length
  };
}

export function toStatusWhere<T extends string>(status: T | T[]) {
  return Array.isArray(status) ? { in: status } : status;
}

export function toAiDraftTaskUpdateData(input: CrmAiDraftTaskUpdateInput): Prisma.CrmAiDraftTaskUncheckedUpdateInput {
  return {
    ...input,
    progressState: input.progressState === undefined ? undefined : toNullableJsonInput(input.progressState),
    resultSummary: input.resultSummary === undefined ? undefined : toNullableJsonInput(input.resultSummary)
  };
}

export function toAiDraftTaskItemUpdateData(
  input: CrmAiDraftTaskItemUpdateInput
): Prisma.CrmAiDraftTaskItemUncheckedUpdateInput {
  return {
    ...input,
    metadata: input.metadata === undefined ? undefined : toNullableJsonInput(input.metadata)
  };
}

export function toEmailTemplateStepCreateManyInput(
  organizationId: string,
  templateGroupId: string,
  steps: CrmEmailTemplateStepInput[]
) {
  return steps.map(step => ({
    organizationId,
    templateGroupId,
    stepIndex: step.stepIndex,
    name: step.name,
    threadMode: step.threadMode,
    delayDays: step.delayDays,
    subjectTemplate: step.subjectTemplate,
    bodyTemplate: step.bodyTemplate
  }));
}

export function toPersonaProfileCreateInput(
  input: CrmPersonaProfileCreateInput
): Prisma.CrmPersonaProfileUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description ?? null,
    titleKeywordsText: input.titleKeywordsText ?? null,
    customerTypeKeywordsText: input.customerTypeKeywordsText ?? null,
    painPoints: input.painPoints ?? null,
    focusText: input.focusText ?? null,
    avoidText: input.avoidText ?? null,
    status: input.status,
    isDefault: input.isDefault,
    createdById: input.createdById,
    createdByName: input.createdByName ?? null
  };
}

export function toPersonaProfileUpdateInput(
  input: CrmPersonaProfileUpdateInput
): Prisma.CrmPersonaProfileUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    titleKeywordsText: input.titleKeywordsText,
    customerTypeKeywordsText: input.customerTypeKeywordsText,
    painPoints: input.painPoints,
    focusText: input.focusText,
    avoidText: input.avoidText,
    status: input.status,
    isDefault: input.isDefault
  };
}

export function toSequencePolicyCreateInput(
  input: CrmSequencePolicyCreateInput
): Prisma.CrmSequencePolicyUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description ?? null,
    status: input.status,
    isDefault: input.isDefault,
    stepDelayDaysText: serializeSequencePolicyStepDelayDays(input.steps),
    stepThreadModesText: serializeSequencePolicyThreadModes(input.steps),
    linkPolicy: input.linkPolicy,
    allowLowRiskAutoSend: input.allowLowRiskAutoSend,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy,
    createdById: input.createdById,
    createdByName: input.createdByName ?? null
  };
}

export function toSequencePolicyUpdateInput(
  input: CrmSequencePolicyUpdateInput
): Prisma.CrmSequencePolicyUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    isDefault: input.isDefault,
    ...(input.steps
      ? {
          stepDelayDaysText: serializeSequencePolicyStepDelayDays(input.steps),
          stepThreadModesText: serializeSequencePolicyThreadModes(input.steps)
        }
      : {}),
    linkPolicy: input.linkPolicy,
    allowLowRiskAutoSend: input.allowLowRiskAutoSend,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy
  };
}

export function toSnippet(bodyText: string) {
  const normalized = bodyText.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

export function resolveGmailThreadStateUpdate(
  thread: Pick<CrmInboxThreadRecord, 'status' | 'unreadCount'>,
  input: Pick<CrmInboxThreadGmailStateSyncInput, 'changeType' | 'labelIds'>
) {
  const labelIds = new Set(input.labelIds);
  const isArchived =
    input.changeType === 'message_deleted' ||
    (input.changeType === 'labels_removed' && labelIds.has('INBOX')) ||
    (input.changeType === 'labels_added' && labelIds.has('TRASH'));

  if (isArchived) {
    if (thread.status === 'archived' && thread.unreadCount === 0) return null;

    return {
      nextStatus: 'archived' as CrmInboxThreadStatus,
      eventType: 'gmail_thread_archived',
      title: 'Gmail 状态同步为归档',
      data: {
        status: 'archived',
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_removed' && labelIds.has('UNREAD')) {
    if (thread.status === 'handled' && thread.unreadCount === 0) return null;

    return {
      nextStatus: 'handled' as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为已读',
      data: {
        status: 'handled',
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_added' && labelIds.has('UNREAD')) {
    if (thread.status === 'pending' && thread.unreadCount > 0) return null;

    return {
      nextStatus: 'pending' as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为未读',
      data: {
        status: 'pending',
        unreadCount: Math.max(thread.unreadCount, 1)
      }
    };
  }

  return null;
}

export * from './prisma-crm-ai-draft.mapper';
export * from './prisma-crm-catalog.mapper';
export * from './prisma-crm-core.mapper';
export * from './prisma-crm-inbox.mapper';
export * from './prisma-crm-mailbox.mapper';
export * from './prisma-crm-sequence.mapper';
export * from './prisma-crm-settings.mapper';
export { isPrismaConcurrentTaskCreateConflict, isPrismaUniqueConflict } from './prisma-error.helpers';
