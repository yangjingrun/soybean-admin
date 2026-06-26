import { BadRequestException } from '@nestjs/common';
import type { CrmMessageStatus, CrmSequenceEnrollmentStatus, CrmSequenceReviewRecord } from '../crm.types';

export const nextDraftEnrollmentStatuses: CrmSequenceEnrollmentStatus[] = ['ready_to_send', 'sequence_running'];
export const blockingNextDraftMessageStatuses: CrmMessageStatus[] = ['draft_pending_review', 'queued', 'failed'];

/** Returns why a sequence cannot generate the next local review draft. */
export function getNextDraftSkipMessage(item: CrmSequenceReviewRecord) {
  if (!nextDraftEnrollmentStatuses.includes(item.enrollment.status)) {
    return '当前序列状态不能生成下一封草稿';
  }

  const sourceMessage = item.messages.at(-1);

  if (!sourceMessage) {
    return '当前序列还没有可参考的开发信';
  }

  if (sourceMessage.stepIndex >= item.enrollment.totalSteps) {
    return '当前序列已达到最大步骤数';
  }

  if (item.messages.some(message => blockingNextDraftMessageStatuses.includes(message.status))) {
    return '已存在下一步草稿或待发送消息，请先处理后再生成';
  }

  return null;
}

/** Asserts next-draft eligibility and returns the source message for draft generation. */
export function requireNextDraftSourceMessage(item: CrmSequenceReviewRecord) {
  const skipMessage = getNextDraftSkipMessage(item);

  if (skipMessage) {
    throw new BadRequestException(skipMessage);
  }

  return item.messages.at(-1)!;
}
