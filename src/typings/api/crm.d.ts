declare namespace Api {
  namespace Crm {
    type CrmAccountStatus =
      | 'candidate'
      | 'missing_contact'
      | 'email_verification_pending'
      | 'manual_review_pending'
      | 'ready'
      | 'sequence_running'
      | 'replied_pending'
      | 'followed_up'
      | 'opportunity'
      | 'customer'
      | 'invalid'
      | 'paused'
      | 'blocked'
      | 'archived';

    type CrmEmailStatus = 'unchecked' | 'valid' | 'invalid' | 'risky' | 'unreachable' | 'unsubscribed';

    type MailboxProvider = 'gmail';

    type MailboxStatus = 'active' | 'paused' | 'auth_expired';

    type MailboxWarmupStage = 'new' | 'warming' | 'ready';

    type ProductLineStatus = 'active' | 'archived';

    type SequenceEnrollmentStatus =
      | 'draft_review_pending'
      | 'ready_to_send'
      | 'sequence_running'
      | 'paused'
      | 'stopped'
      | 'replied'
      | 'archived';

    type MessageStatus = 'draft_pending_review' | 'draft_ready' | 'queued' | 'sent' | 'failed' | 'skipped';

    type MessageThreadMode = 'new_subject' | 'same_thread';

    type InboxThreadStatus = 'pending' | 'handled' | 'archived';

    type InboxMessageDirection = 'inbound' | 'outbound';

    interface LeadRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      name: string;
      normalizedName: string;
      websiteUrl: string | null;
      domain: string | null;
      country: string | null;
      customerType: string | null;
      status: CrmAccountStatus;
      sourceTaskId: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface LeadContact {
      id: string;
      organizationId: string;
      accountId: string;
      ownerUserId: string;
      fullName: string | null;
      title: string | null;
      email: string;
      emailHash: string;
      maskedEmail: string;
      isPublicEmail: boolean;
      emailStatus: CrmEmailStatus;
      sourceTaskId: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface LeadTimelineEvent {
      id: string;
      organizationId: string;
      accountId: string;
      contactId: string | null;
      ownerUserId: string;
      eventType: string;
      title: string;
      content: string | null;
      metadata: unknown;
      createdAt: string;
    }

    interface LeadDetail {
      account: LeadRecord;
      contacts: LeadContact[];
      timelineEvents: LeadTimelineEvent[];
    }

    interface LeadSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: CrmAccountStatus;
    }

    interface LeadFilterModel {
      keyword: string;
      status: CrmAccountStatus | null;
    }

    interface LeadStatusPayload {
      status: CrmAccountStatus;
      remark?: string;
    }

    interface LeadNotePayload {
      content: string;
    }

    interface LeadArchivePayload {
      reason?: string;
    }

    interface LeadStatusResult {
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface LeadNoteResult {
      event: LeadTimelineEvent;
    }

    interface LeadContactEmailVerifyResult {
      contact: LeadContact;
      event: LeadTimelineEvent;
    }

    interface LeadArchiveResult {
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    type LeadList = Api.Common.PaginatingQueryRecord<LeadRecord>;

    interface MailboxRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      ownerUserName: string;
      provider: MailboxProvider;
      emailAddress: string;
      maskedEmail: string;
      status: MailboxStatus;
      dailyLimit: number;
      hourlyLimit: number;
      warmupStage: MailboxWarmupStage;
      watchExpiration: string | null;
      lastHistoryId: string | null;
      authorizedAt: string | null;
      pausedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface MailboxSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: MailboxStatus;
    }

    interface MailboxFilterModel {
      keyword: string;
      status: MailboxStatus | null;
    }

    interface MailboxAuthorizePayload {
      emailAddress: string;
    }

    interface MailboxAuthorizeFormModel {
      emailAddress: string;
    }

    interface GmailOAuthUrlResult {
      authorizationUrl: string;
      state: string;
    }

    interface GmailOAuthCallbackPayload {
      code: string;
      state: string;
    }

    interface MailboxOperateResult {
      mailbox: MailboxRecord;
    }

    interface MailboxWatchRenewResult extends MailboxOperateResult {
      watch: {
        historyId: string;
        watchExpiration: string;
      };
    }

    type MailboxList = Api.Common.PaginatingQueryRecord<MailboxRecord>;

    interface ProductLineRecord {
      id: string;
      organizationId: string;
      name: string;
      targetCustomerType: string | null;
      coreSellingPoints: string | null;
      moq: string | null;
      leadTime: string | null;
      paymentTerms: string | null;
      certifications: string | null;
      catalogUrl: string | null;
      websiteUrl: string | null;
      commonModelsText: string | null;
      status: ProductLineStatus;
      createdById: string;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface ProductLineSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: ProductLineStatus;
    }

    interface ProductLineFilterModel {
      keyword: string;
      status: ProductLineStatus | null;
    }

    interface ProductLinePayload {
      name: string;
      targetCustomerType: string;
      coreSellingPoints: string;
      moq: string;
      leadTime: string;
      paymentTerms: string;
      certifications: string;
      catalogUrl: string;
      websiteUrl: string;
      commonModelsText: string;
    }

    type ProductLineFormModel = ProductLinePayload;

    interface ProductLineOperateResult {
      productLine: ProductLineRecord;
    }

    type ProductLineList = Api.Common.PaginatingQueryRecord<ProductLineRecord>;

    interface TemplateVariable {
      key: string;
      label: string;
      source: string;
    }

    interface DefaultTemplateStep {
      stepIndex: number;
      name: string;
      threadMode: MessageThreadMode;
      delayDays: number;
      subjectTemplate: string;
      bodyTemplate: string;
    }

    interface PersonaProfile {
      label: string;
      aliases: string[];
      focusText: string;
      draftFocusText: string;
    }

    interface TemplateDefaults {
      templateGroup: {
        id: string;
        name: string;
        scope: 'global';
        language: string;
        variables: TemplateVariable[];
        steps: DefaultTemplateStep[];
      };
      personas: PersonaProfile[];
    }

    interface SequenceEnrollmentRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      accountId: string;
      contactId: string;
      productLineId: string | null;
      mailboxId: string | null;
      name: string;
      status: SequenceEnrollmentStatus;
      currentStep: number;
      totalSteps: number;
      runVersion: number;
      createdById: string;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface MessageRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      accountId: string;
      contactId: string;
      enrollmentId: string;
      mailboxId: string | null;
      stepIndex: number;
      threadMode: MessageThreadMode;
      subject: string;
      bodyText: string;
      status: MessageStatus;
      scheduledAt: string | null;
      sentAt: string | null;
      bullJobId: string | null;
      providerMessageId: string | null;
      providerThreadId: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface InboxThreadRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      accountId: string;
      contactId: string | null;
      enrollmentId: string | null;
      mailboxId: string | null;
      provider: MailboxProvider;
      providerThreadId: string | null;
      subject: string;
      status: InboxThreadStatus;
      lastInboundAt: string;
      unreadCount: number;
      createdAt: string;
      updatedAt: string;
      account: LeadRecord;
      contact: LeadContact | null;
      mailbox: MailboxRecord | null;
      enrollment: SequenceEnrollmentRecord | null;
      messageCount: number;
      lastMessageSnippet: string;
    }

    interface InboxMessageRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      accountId: string;
      contactId: string | null;
      enrollmentId: string | null;
      mailboxId: string | null;
      threadId: string;
      provider: MailboxProvider;
      providerMessageId: string | null;
      replyToMessageId: string | null;
      fromEmail: string;
      fromEmailHash: string;
      maskedFromEmail: string;
      direction: InboxMessageDirection;
      subject: string;
      snippet: string | null;
      bodyText: string;
      messageType: 'customer_reply' | 'bounce' | 'unsubscribe_hint';
      sentAt: string | null;
      receivedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface InboxThreadDetail {
      thread: InboxThreadRecord;
      account: LeadRecord;
      contact: LeadContact | null;
      mailbox: MailboxRecord | null;
      enrollment: SequenceEnrollmentRecord | null;
      messages: InboxMessageRecord[];
      timelineEvents: LeadTimelineEvent[];
      canOperate: boolean;
    }

    interface InboxReplyPayload {
      bodyText: string;
    }

    interface SequenceReviewChecklistItem {
      key: string;
      label: string;
      passed: boolean;
      message: string;
    }

    interface SequenceReviewItem {
      enrollment: SequenceEnrollmentRecord;
      account: LeadRecord;
      contact: LeadContact;
      productLine: ProductLineRecord | null;
      mailbox: MailboxRecord | null;
      firstMessage: MessageRecord | null;
      canOperateDraft: boolean;
      canControlSequence: boolean;
      checklist: SequenceReviewChecklistItem[];
    }

    interface SequenceReviewSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: SequenceEnrollmentStatus;
    }

    interface InboxThreadSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: InboxThreadStatus;
      mailboxId?: string;
    }

    interface SequenceReviewFilterModel {
      keyword: string;
      status: SequenceEnrollmentStatus | null;
    }

    interface InboxThreadFilterModel {
      keyword: string;
      status: InboxThreadStatus | null;
      mailboxId: string | null;
    }

    interface SequenceReviewCreatePayload {
      accountId: string;
      contactId: string;
      productLineId?: string;
      mailboxId?: string;
    }

    interface SequenceReviewCreateFormModel {
      accountId: string | null;
      contactId: string | null;
      productLineId: string | null;
      mailboxId: string | null;
    }

    interface MessageDraftPayload {
      subject: string;
      bodyText: string;
    }

    interface InboxThreadStatusPayload {
      status: InboxThreadStatus;
    }

    interface MessageMockReplyPayload {
      subject?: string;
      bodyText: string;
      receivedAt?: string;
    }

    interface SequenceReviewOperateResult {
      item: SequenceReviewItem;
    }

    interface MessageDraftUpdateResult {
      message: MessageRecord;
    }

    interface MessageDraftApproveResult {
      enrollment: SequenceEnrollmentRecord;
      message: MessageRecord;
    }

    interface MessageSendStartResult {
      enrollment: SequenceEnrollmentRecord;
      message: MessageRecord;
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface SequenceStopResult {
      enrollment: SequenceEnrollmentRecord;
      message: MessageRecord | null;
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface InboxThreadStatusResult {
      thread: InboxThreadRecord;
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    type SequenceReviewList = Api.Common.PaginatingQueryRecord<SequenceReviewItem>;

    type InboxThreadList = Api.Common.PaginatingQueryRecord<InboxThreadRecord>;
  }
}
