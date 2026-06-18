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

    type CrmEmailStatus = 'unchecked' | 'valid' | 'invalid' | 'risky' | 'unreachable';

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

    interface MailboxOperateResult {
      mailbox: MailboxRecord;
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
      createdAt: string;
      updatedAt: string;
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
      checklist: SequenceReviewChecklistItem[];
    }

    interface SequenceReviewSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: SequenceEnrollmentStatus;
    }

    interface SequenceReviewFilterModel {
      keyword: string;
      status: SequenceEnrollmentStatus | null;
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

    type SequenceReviewList = Api.Common.PaginatingQueryRecord<SequenceReviewItem>;
  }
}
