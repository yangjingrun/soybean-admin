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
  }
}
