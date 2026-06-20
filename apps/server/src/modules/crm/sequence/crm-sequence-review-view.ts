import { isOrganizationAdmin as hasOrganizationAdminRole } from '../../../shared/permission-policy';
import { buildPersonaMatch, type ResolvedPersonaMatch } from '../crm-persona-match';
import type {
  CrmAiDraftMetadata,
  CrmContactRecord,
  CrmEmailStatus,
  CrmMessageRecord,
  CrmPersonaMatchInfo,
  CrmProductLineRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequencePolicyRecord,
  CrmSequenceReviewRecord,
  CrmUserContext
} from '../crm.types';
import { toAccountView, toContactView, toMailboxView } from '../shared/crm-view-mappers';

/** Maps a sequence review aggregate to the frontend review drawer shape. */
export function toSequenceReviewView(
  record: CrmSequenceReviewRecord,
  context: CrmUserContext,
  personaMatch = buildPersonaMatch([], record.account, record.contact)
) {
  return {
    enrollment: toSequenceEnrollmentView(record.enrollment),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    productLine: record.productLine ? toProductLineView(record.productLine) : null,
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    policy: record.policy ? toSequencePolicyView(record.policy) : null,
    firstMessage: record.firstMessage ? toMessageView(record.firstMessage) : null,
    messages: record.messages.map(toMessageView),
    canOperateDraft: record.enrollment.ownerUserId === context.userId,
    canControlSequence: record.enrollment.ownerUserId === context.userId || hasOrganizationAdminRole(context),
    personaMatch: toPersonaMatchView(personaMatch),
    checklist: buildReviewChecklist(record, personaMatch)
  };
}

function buildReviewChecklist(record: CrmSequenceReviewRecord, personaMatch: ResolvedPersonaMatch) {
  return [
    {
      key: 'mailbox_active',
      label: '发送邮箱',
      passed: record.mailbox?.status === 'active',
      message: record.mailbox?.status === 'active' ? `已选择 ${record.mailbox.maskedEmail}` : '未选择启用的发送邮箱'
    },
    {
      key: 'personal_email',
      label: '联系人邮箱',
      passed: !record.contact.isPublicEmail,
      message: record.contact.isPublicEmail ? '公共邮箱，建议人工确认' : `个人邮箱 ${record.contact.maskedEmail}`
    },
    {
      key: 'email_verified',
      label: '邮箱验证',
      passed: record.contact.emailStatus === 'valid',
      message: `当前状态：${toEmailStatusText(record.contact.emailStatus)}`
    },
    {
      key: 'product_line',
      label: '产品资料',
      passed: record.productLine?.status === 'active',
      message: record.productLine?.status === 'active' ? record.productLine.name : '未选择启用的产品资料'
    },
    {
      key: 'persona_focus',
      label: '职位画像',
      passed: Boolean(personaMatch.persona),
      message: buildPersonaMatchChecklistMessage(personaMatch, record.contact)
    },
    {
      key: 'draft_content',
      label: '首封草稿',
      passed: Boolean(record.firstMessage?.subject && record.firstMessage.bodyText),
      message: record.firstMessage ? '已生成首封纯文本草稿' : '尚未生成首封草稿'
    }
  ];
}

function toProductLineView(record: CrmProductLineRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toSequencePolicyView(record: CrmSequencePolicyRecord) {
  return {
    ...record,
    steps: record.steps.map(step => ({ ...step })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toSequenceEnrollmentView(record: CrmSequenceEnrollmentRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toMessageView(record: CrmMessageRecord) {
  return {
    ...record,
    aiDraft: readCrmMessageAiDraftMetadata(record.metadata),
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    sentAt: record.sentAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toPersonaMatchView(match: ResolvedPersonaMatch): CrmPersonaMatchInfo {
  return {
    persona: match.persona,
    matchMethod: match.matchMethod,
    matchedKeywords: match.matchedKeywords,
    fallbackReason: match.fallbackReason
  };
}

function buildPersonaMatchChecklistMessage(match: ResolvedPersonaMatch, contact: Pick<CrmContactRecord, 'title'>) {
  if (match.persona) {
    const reason =
      match.matchMethod === 'title'
        ? `因职位关键词 ${match.matchedKeywords.join('、')} 命中`
        : match.matchMethod === 'customer_type'
          ? `因客户类型关键词 ${match.matchedKeywords.join('、')} 命中`
          : match.fallbackReason;

    return reason ? `已匹配 ${match.persona.name}：${reason}` : `已匹配 ${match.persona.name}`;
  }

  return contact.title ? match.fallbackReason : '缺少联系人职位，按通用开发信生成';
}

function readCrmMessageAiDraftMetadata(metadata: unknown): CrmAiDraftMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

  const value = (metadata as { aiDraft?: unknown }).aiDraft;

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Partial<CrmAiDraftMetadata>;

  if (record.generated !== true || typeof record.reason !== 'string' || !Array.isArray(record.riskNotes)) {
    return null;
  }

  if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) {
    return null;
  }

  return record as CrmAiDraftMetadata;
}

function toEmailStatusText(status: CrmEmailStatus) {
  const textMap: Record<CrmEmailStatus, string> = {
    unchecked: '未验证',
    valid: '有效',
    invalid: '无效',
    risky: '风险',
    unreachable: '暂不可达',
    unsubscribed: '已退订'
  };

  return textMap[status];
}
