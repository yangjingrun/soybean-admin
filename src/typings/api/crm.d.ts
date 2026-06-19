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

    type MailboxSyncIssueType = 'history_expired';

    type ProductLineStatus = 'active' | 'archived';

    type PersonaProfileStatus = 'active' | 'archived';

    type EmailTemplateStatus = 'active' | 'archived';

    type SequencePolicyStatus = 'active' | 'archived';

    type SequencePolicyLinkPolicy = 'preserve_template_links' | 'block_new_links';

    type SequencePolicySameCompanyStrategy = 'single_active_per_company' | 'allow_multiple_contacts';

    type SequenceEnrollmentStatus =
      | 'draft_review_pending'
      | 'ready_to_send'
      | 'sequence_running'
      | 'paused'
      | 'stopped'
      | 'replied'
      | 'archived';
    type SequenceReviewTodoType =
      | 'draft_review_pending'
      | 'follow_up_draft_review'
      | 'ready_to_start'
      | 'can_generate_next'
      | 'send_failed'
      | 'max_steps_reached';

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
      archivedAt: string | null;
      archiveReason: string | null;
      archiveSlimmedAt: string | null;
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

    interface LeadImportContactPayload {
      fullName?: string;
      title?: string;
      email?: string;
    }

    interface LeadImportPayload {
      name: string;
      websiteUrl?: string;
      country?: string;
      customerType?: string;
      contact?: LeadImportContactPayload;
    }

    interface LeadImportFormModel {
      name: string;
      websiteUrl: string;
      country: string;
      customerType: string;
      contactFullName: string;
      contactTitle: string;
      contactEmail: string;
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

    interface GlobalConfig {
      configKey: string;
      emailVerificationCooldownDays: number;
      ownerConcurrentSendLimit: number;
      followUpDelayDays: FollowUpDelayDays;
      updatedAt: string;
    }

    interface FollowUpDelayDays {
      step2Days: number;
      step3Days: number;
      step4Days: number;
      step5Days: number;
    }

    interface SaveGlobalConfigPayload {
      emailVerificationCooldownDays: number;
      ownerConcurrentSendLimit: number;
      followUpDelayDays: FollowUpDelayDays;
    }

    interface GlobalConfigFormModel {
      emailVerificationCooldownDays: number | null;
      ownerConcurrentSendLimit: number | null;
      followUpDelayDays: FollowUpDelayDays;
    }

    interface OrganizationConfig {
      id: string | null;
      organizationId: string;
      allowAdminViewMemberEmailBody: boolean;
      updatedAt: string | null;
    }

    interface SaveOrganizationConfigPayload {
      allowAdminViewMemberEmailBody: boolean;
    }

    interface BlacklistRecord {
      id: string;
      organizationId: string;
      maskedEmail: string;
      reason: 'unsubscribe';
      sourceAccountId: string | null;
      sourceContactId: string | null;
      sourceMessageId: string | null;
      createdById: string | null;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface BlacklistSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
    }

    interface BlacklistFilterModel {
      keyword: string;
    }

    interface BlacklistRemovePayload {
      reason: string;
    }

    interface BlacklistRemoveResult {
      blacklistEntry: BlacklistRecord;
    }

    interface LeadArchiveResult {
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface LeadRestoreResult {
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface LeadImportResult {
      account: LeadRecord;
      contact: LeadContact | null;
    }

    type LeadList = Api.Common.PaginatingQueryRecord<LeadRecord>;

    type BlacklistList = Api.Common.PaginatingQueryRecord<BlacklistRecord>;

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
      lastSyncIssue: MailboxSyncIssue | null;
      authorizedAt: string | null;
      pausedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface MailboxSyncIssue {
      type: MailboxSyncIssueType;
      message: string;
      happenedAt: string;
    }

    interface MailboxSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: MailboxStatus;
    }

    interface MailboxFilterModel {
      keyword: string;
      status: MailboxStatus | null;
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

    interface MailboxSyncNowResult extends MailboxWatchRenewResult {
      sync:
        | {
            queued: true;
            jobId: string;
            fromHistoryId: string;
            toHistoryId: string;
          }
        | {
            queued: false;
            reason: 'checkpoint_initialized' | 'checkpoint_reinitialized' | 'already_current';
            fromHistoryId: string | null;
            toHistoryId: string;
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
      aiWritingConfig: ProductLineAiWritingConfig | null;
      status: ProductLineStatus;
      createdById: string;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    type AiWritingStepIndex = 1 | 2 | 3 | 4 | 5;

    interface ProductLineAiWritingStepConfig {
      stepIndex: AiWritingStepIndex;
      prompt: string;
    }

    interface ProductLineAiWritingConfig {
      enabled: boolean;
      commonRequirements: string;
      forbiddenClaims: string;
      productEmphasis: string;
      steps: ProductLineAiWritingStepConfig[];
    }

    interface AiDraftSnapshot {
      productLineId: string;
      productLineName: string;
      stepIndex: AiWritingStepIndex;
      writingConfig: ProductLineAiWritingConfig;
      reason: string;
      riskNotes: string[];
      generatedAt: string;
    }

    interface AiDraftMetadata {
      generated: true;
      reason: string;
      riskNotes: string[];
      snapshot: AiDraftSnapshot;
    }

    interface InboxReplyDraftMetadata {
      generated: boolean;
      reason: string;
      riskNotes: string[];
      productLineId?: string | null;
      productLineName?: string | null;
      generatedAt?: string;
    }

    interface InboxReplyDraftRecord {
      topic: string;
      bodyText: string;
      metadata: InboxReplyDraftMetadata | null;
      updatedAt: string;
      updatedById: string;
      updatedByName: string | null;
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
      aiWritingConfig: ProductLineAiWritingConfig;
    }

    type ProductLineFormModel = ProductLinePayload;

    interface ProductLineOperateResult {
      productLine: ProductLineRecord;
    }

    type ProductLineList = Api.Common.PaginatingQueryRecord<ProductLineRecord>;

    interface ProductLineAiPromptVersionRecord {
      id: string;
      organizationId: string;
      productLineId: string;
      version: number;
      aiWritingConfig: ProductLineAiWritingConfig | null;
      editorId: string;
      editorName: string | null;
      changeSummary: string | null;
      createdAt: string;
    }

    interface ProductLineAiPromptVersionList {
      records: ProductLineAiPromptVersionRecord[];
    }

    interface ProductLineAiPromptVersionRestoreResult {
      productLine: ProductLineRecord;
      version: ProductLineAiPromptVersionRecord;
    }

    interface PersonaProfileRecord {
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      titleKeywordsText: string | null;
      customerTypeKeywordsText: string | null;
      painPoints: string | null;
      focusText: string | null;
      avoidText: string | null;
      status: PersonaProfileStatus;
      isDefault: boolean;
      createdById: string;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface PersonaProfileSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: PersonaProfileStatus;
    }

    interface PersonaProfileFilterModel {
      keyword: string;
      status: PersonaProfileStatus | null;
    }

    interface PersonaProfilePayload {
      name: string;
      description: string;
      titleKeywordsText: string;
      customerTypeKeywordsText: string;
      painPoints: string;
      focusText: string;
      avoidText: string;
      isDefault: boolean;
    }

    type PersonaProfileFormModel = PersonaProfilePayload;

    interface PersonaProfileOperateResult {
      personaProfile: PersonaProfileRecord;
    }

    type PersonaProfileList = Api.Common.PaginatingQueryRecord<PersonaProfileRecord>;

    type PersonaMatchMethod = 'title' | 'customer_type' | 'default' | 'builtin' | 'none';

    type PersonaMatchSource = 'organization' | 'builtin';

    interface PersonaMatchInfo {
      persona: {
        id: string | null;
        name: string;
        source: PersonaMatchSource;
      } | null;
      matchMethod: PersonaMatchMethod;
      matchedKeywords: string[];
      fallbackReason: string | null;
    }

    interface EmailTemplateStepRecord {
      id: string;
      organizationId: string;
      templateGroupId: string;
      stepIndex: number;
      name: string;
      threadMode: MessageThreadMode;
      delayDays: number;
      subjectTemplate: string;
      bodyTemplate: string;
      createdAt: string;
      updatedAt: string;
    }

    interface EmailTemplateGroupRecord {
      id: string;
      organizationId: string;
      name: string;
      language: string;
      description: string | null;
      status: EmailTemplateStatus;
      isDefault: boolean;
      steps: EmailTemplateStepRecord[];
      createdById: string;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface EmailTemplateSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: EmailTemplateStatus;
    }

    interface EmailTemplateFilterModel {
      keyword: string;
      status: EmailTemplateStatus | null;
    }

    interface EmailTemplateStepPayload {
      stepIndex: number;
      name: string;
      threadMode: MessageThreadMode;
      delayDays: number;
      subjectTemplate: string;
      bodyTemplate: string;
    }

    interface EmailTemplatePayload {
      name: string;
      language: string;
      description: string;
      steps: EmailTemplateStepPayload[];
    }

    type EmailTemplateFormModel = EmailTemplatePayload;

    interface EmailTemplateOperateResult {
      templateGroup: EmailTemplateGroupRecord;
    }

    type EmailTemplateList = Api.Common.PaginatingQueryRecord<EmailTemplateGroupRecord>;

    interface SequencePolicyStep {
      stepIndex: number;
      delayDays: number;
      threadMode: MessageThreadMode;
    }

    interface SequencePolicyRecord {
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      status: SequencePolicyStatus;
      isDefault: boolean;
      steps: SequencePolicyStep[];
      linkPolicy: SequencePolicyLinkPolicy;
      allowLowRiskAutoSend: boolean;
      sameCompanyContactStrategy: SequencePolicySameCompanyStrategy;
      createdById: string;
      createdByName: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface SequencePolicySearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: SequencePolicyStatus;
    }

    interface SequencePolicyFilterModel {
      keyword: string;
      status: SequencePolicyStatus | null;
    }

    interface SequencePolicyPayload {
      name: string;
      description: string;
      isDefault: boolean;
      steps: SequencePolicyStep[];
      linkPolicy: SequencePolicyLinkPolicy;
      allowLowRiskAutoSend: boolean;
      sameCompanyContactStrategy: SequencePolicySameCompanyStrategy;
    }

    type SequencePolicyFormModel = SequencePolicyPayload;

    interface SequencePolicyOperateResult {
      policy: SequencePolicyRecord;
    }

    type SequencePolicyList = Api.Common.PaginatingQueryRecord<SequencePolicyRecord>;

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
      id?: string;
      label: string;
      aliases: string[];
      focusText: string;
      draftFocusText: string;
      painPoints?: string | null;
      avoidText?: string | null;
      source?: 'built_in' | 'organization';
    }

    interface TemplateDefaults {
      templateGroup: {
        id: string;
        name: string;
        scope: 'global' | 'organization';
        language: string;
        description?: string | null;
        status?: EmailTemplateStatus;
        isDefault?: boolean;
        variables: TemplateVariable[];
        steps: DefaultTemplateStep[];
      };
      personas: PersonaProfile[];
    }

    type StrategyStatDimension = 'template' | 'policy' | 'persona' | 'productLine';

    interface StrategyStatRow {
      dimension: StrategyStatDimension;
      key: string;
      name: string;
      sequenceCount: number;
      draftPendingCount: number;
      readyCount: number;
      queuedCount: number;
      sentCount: number;
      failedCount: number;
      repliedCount: number;
      stoppedCount: number;
    }

    interface StrategyStats {
      generatedAt: string;
      rows: Record<StrategyStatDimension, StrategyStatRow[]>;
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
      metadata?: unknown | null;
      aiDraft?: AiDraftMetadata | null;
      createdAt: string;
      updatedAt: string;
    }

    interface MessageDraftVersionRecord {
      id: string;
      organizationId: string;
      ownerUserId: string;
      accountId: string;
      contactId: string;
      enrollmentId: string;
      messageId: string;
      mailboxId: string | null;
      stepIndex: number;
      versionNo: number;
      subject: string;
      bodyText: string;
      editorId: string;
      editorName: string | null;
      createdAt: string;
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
      canReadBody: boolean;
      canOperate: boolean;
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
      replyDraft: InboxReplyDraftRecord | null;
    }

    interface InboxReplyPayload {
      bodyText: string;
    }

    interface InboxReplyPolishPayload {
      topic: string;
      productLineId?: string | null;
    }

    interface InboxReplyDraftPayload {
      topic: string;
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
      policy: SequencePolicyRecord | null;
      firstMessage: MessageRecord | null;
      messages: MessageRecord[];
      canOperateDraft: boolean;
      canControlSequence: boolean;
      personaMatch: PersonaMatchInfo;
      checklist: SequenceReviewChecklistItem[];
    }

    interface SequenceReviewSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: SequenceEnrollmentStatus;
      todoType?: SequenceReviewTodoType;
    }

    interface InboxThreadSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: InboxThreadStatus;
      mailboxId?: string;
    }

    interface SequenceReviewFilterModel {
      keyword: string;
      status: SequenceEnrollmentStatus | null;
      todoType: SequenceReviewTodoType | null;
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
      policyId?: string;
    }

    interface SequenceReviewBatchPayload {
      ids: string[];
    }

    interface SequenceReviewCreateFormModel {
      accountId: string | null;
      contactId: string | null;
      productLineId: string | null;
      mailboxId: string | null;
      policyId: string | null;
    }

    interface MessageDraftPayload {
      subject: string;
      bodyText: string;
    }

    interface InboxThreadStatusPayload {
      status: InboxThreadStatus;
    }

    interface SequenceReviewOperateResult {
      item: SequenceReviewItem;
    }

    interface MessageDraftUpdateResult {
      message: MessageRecord;
    }

    interface MessageDraftVersionListResult {
      versions: MessageDraftVersionRecord[];
    }

    interface MessageDraftVersionRestoreResult {
      message: MessageRecord;
    }

    interface MessageDraftApproveResult {
      enrollment: SequenceEnrollmentRecord;
      message: MessageRecord;
    }

    interface MessageNextDraftGenerateResult {
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

    type SequenceBatchItemStatus = 'success' | 'skipped' | 'failed';

    interface SequenceBatchItemResult {
      id: string;
      status: SequenceBatchItemStatus;
      message: string;
      enrollmentId?: string;
      messageId?: string;
      stepIndex?: number;
    }

    interface SequenceBatchOperateResult {
      totalCount: number;
      successCount: number;
      skippedCount: number;
      failedCount: number;
      results: SequenceBatchItemResult[];
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
