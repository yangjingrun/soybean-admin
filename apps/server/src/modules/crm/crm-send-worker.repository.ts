import type {
  CrmEmailTemplateGroupRecord,
  CrmGlobalConfigRecord,
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMessageRecord,
  CrmQueuedMessageSendDeferInput,
  CrmQueuedMessageSendTargetInput,
  CrmQueuedMessageSendTargetRecord,
  CrmSendCompletionInput,
  CrmSendCompletionRecord,
  CrmSendDeliveryClaimInput,
  CrmSendDeliveryClaimRecord,
  CrmSendPreferenceRecord,
  CrmSendFailureInput,
  CrmSendFailureRecord
} from './crm.types';

/** Data port for guarded CRM email delivery and completion. */
export interface CrmSendWorkerRepository {
  findQueuedMessageSendTarget(input: CrmQueuedMessageSendTargetInput): Promise<CrmQueuedMessageSendTargetRecord | null>;
  deferQueuedMessageSend(input: CrmQueuedMessageSendDeferInput): Promise<CrmMessageRecord | null>;
  claimFirstMessageSendDelivery(input: CrmSendDeliveryClaimInput): Promise<CrmSendDeliveryClaimRecord | null>;
  completeFirstMessageSend(input: CrmSendCompletionInput): Promise<CrmSendCompletionRecord | null>;
  failFirstMessageSend(input: CrmSendFailureInput): Promise<CrmSendFailureRecord | null>;
  markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null>;
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  getSendPreference(args: { organizationId: string; ownerUserId: string }): Promise<CrmSendPreferenceRecord | null>;
  findDefaultEmailTemplateGroup(organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
}
