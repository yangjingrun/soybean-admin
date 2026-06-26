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

    type LeadEnrichmentProvider = 'hunter' | 'snovio';

    type LeadEnrichmentStatus = 'success' | 'failed';

    type MailboxProvider = 'gmail';

    type MailboxStatus = 'active' | 'paused' | 'auth_expired' | 'revoked';

    type MailboxWarmupStage = 'new' | 'warming' | 'ready';

    type MailboxSyncMode = 'full_sync' | 'send_only' | 'mock_watch';

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

    type ContactEmailProgressStatus = MessageStatus | 'not_generated' | 'replied';

    type MessageThreadMode = 'new_subject' | 'same_thread';

    type InboxThreadStatus = 'pending' | 'bounced' | 'handled' | 'archived';

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
      city: string | null;
      address: string | null;
      latitude?: number | null;
      longitude?: number | null;
      timeZone?: string | null;
      customerType: string | null;
      status: CrmAccountStatus;
      sourceTaskId: string | null;
      sourceSnapshot?: Record<string, unknown> | null;
      archivedAt: string | null;
      archiveReason: string | null;
      archiveSlimmedAt: string | null;
      createdAt: string;
      updatedAt: string;
      contactCount: number;
      primaryContact: LeadContact | null;
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
      emailProgressStatus: ContactEmailProgressStatus;
      emailProgressLabel: string;
      emailProgressAt: string | null;
      emailProgressMessageId: string | null;
      emailProgressStepIndex: number | null;
      emailProgressTotalSteps: number | null;
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

    interface LeadEnrichmentHistory {
      id: string;
      organizationId: string;
      ownerUserId: string;
      accountId: string | null;
      contactId: string | null;
      provider: LeadEnrichmentProvider;
      identityType: 'domain';
      identityValue: string;
      status: LeadEnrichmentStatus;
      lastAttemptedAt: string;
      lastSucceededAt: string | null;
      maskedEmail: string | null;
      errorMessage: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface LeadDetail {
      account: LeadRecord;
      contacts: LeadContact[];
      enrichmentHistories: LeadEnrichmentHistory[];
      timelineEvents: LeadTimelineEvent[];
    }

    interface LeadSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      contactTitle?: string;
      customerType?: string;
      region?: string;
      regionKeywords?: string;
      status?: CrmAccountStatus;
      sourceTaskId?: string;
      updatedFrom?: string;
      updatedTo?: string;
    }

    interface LeadFilterModel {
      keyword: string;
      contactTitle: string;
      customerType: string;
      region: string;
      status: CrmAccountStatus | null;
      sourceTaskId: string | null;
      updatedAtRange: [number, number] | null;
    }

    interface GeoCountryOption {
      code: string;
      label: string;
      cityCount: number;
    }

    interface GeoCityOption {
      name: string;
      asciiName: string | null;
      displayName: string | null;
      countryCode: string;
      timeZone: string;
    }

    interface GeoCitySearchParams {
      countryCode?: string;
      keyword?: string;
      limit?: number;
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
      city?: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      timeZone?: string;
      customerType?: string;
      sourceTaskId?: string | null;
      sourceSnapshot?: Record<string, unknown> | null;
      contact?: LeadImportContactPayload;
    }

    interface LeadImportFormModel {
      name: string;
      websiteUrl: string;
      country: string;
      city: string;
      address: string;
      timeZone: string;
      customerType: string;
      contactFullName: string;
      contactTitle: string;
      contactEmail: string;
    }

    interface LeadStatusPayload {
      status: CrmAccountStatus;
      remark?: string;
    }

    interface LeadAccountUpdatePayload {
      name: string;
      normalizedName: string;
      websiteUrl?: string;
      country?: string;
      city?: string;
      address?: string;
      timeZone?: string;
      customerType?: string;
    }

    interface LeadNotePayload {
      content: string;
    }

    interface LeadContactFormModel {
      fullName: string;
      title: string;
      email: string;
    }

    interface LeadContactCreatePayload {
      fullName?: string;
      title?: string;
      email: string;
    }

    interface LeadContactUpdatePayload {
      fullName?: string;
      title?: string;
      email?: string;
    }

    interface LeadArchivePayload {
      reason?: string;
    }

    interface LeadEnrichmentRefreshPayload {
      provider: 'hunter';
    }

    interface LeadStatusResult {
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface LeadAccountUpdateResult {
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    interface LeadNoteResult {
      event: LeadTimelineEvent;
    }

    interface LeadContactEmailVerifyResult {
      account: LeadRecord;
      contact: LeadContact;
      event: LeadTimelineEvent;
    }

    interface LeadContactMutateResult {
      contact: LeadContact;
      account?: LeadRecord;
    }

    interface LeadEnrichmentRefreshResult {
      contact: LeadContact | null;
      enrichmentHistory: LeadEnrichmentHistory;
    }

    interface GlobalConfig {
      configKey: string;
      emailVerificationCooldownDays: number;
      ownerConcurrentSendLimit: number;
      ownerDailySendLimitMax: number;
      followUpDelayDays: FollowUpDelayDays;
      sendWorkdays: number[];
      sendWindows: SendWindow[];
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
      ownerDailySendLimitMax: number;
      followUpDelayDays: FollowUpDelayDays;
      sendWorkdays: number[];
      sendWindows: SendWindow[];
    }

    interface GlobalConfigFormModel {
      emailVerificationCooldownDays: number | null;
      ownerConcurrentSendLimit: number | null;
      ownerDailySendLimitMax: number | null;
      followUpDelayDays: FollowUpDelayDays;
      sendWorkdays: number[];
      sendWindows: SendWindow[];
    }

    interface SendWindow {
      startMinute: number;
      endMinute: number;
    }

    interface SendPreference {
      dailySendLimit: number;
      followUpSharePercent: number;
      emailOpenTrackingEnabled: boolean;
      ownerDailySendLimitMax: number;
    }

    interface SaveSendPreferencePayload {
      dailySendLimit: number;
      followUpSharePercent: number;
      emailOpenTrackingEnabled: boolean;
    }

    interface SendPreferenceFormModel {
      dailySendLimit: number | null;
      followUpSharePercent: number | null;
      emailOpenTrackingEnabled: boolean;
      ownerDailySendLimitMax: number;
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
      syncMode: MailboxSyncMode;
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

    interface CurrentUserOutreachStateClearResult {
      deletedAiDraftTaskCount: number;
      deletedAiDraftTaskItemCount: number;
      deletedDraftVersionCount: number;
      deletedEnrollmentCount: number;
      deletedMessageCount: number;
      deletedOpenEventCount: number;
      deletedTimelineEventCount: number;
      resetAccountCount: number;
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
      promptTemplateKey?: 'crm_outreach_general';
      steps: ProductLineAiWritingStepConfig[];
      sequenceStrategy?: 'core_3_step' | 'full_5_step';
      languagePolicy?: 'account_locale_or_english' | 'english' | 'local_language';
      tone?: 'consultative' | 'direct' | 'formal';
      ctaPreference?: 'low_friction_question' | 'meeting' | 'quote' | 'referral';
      polishPolicy?: 'auto_when_flagged' | 'always' | 'off';
      proofAssets?: string;
      regionNotes?: string;
    }

    interface AiDraftSelectedModuleSnapshot {
      promptKey: string;
      title: string;
      reason: string;
      updatedAt?: string | null;
    }

    interface AiDraftPublicFactSnapshot {
      id: string;
      label: string;
      value: string;
      source:
        | 'account'
        | 'contact'
        | 'product_line'
        | 'persona'
        | 'previous_message'
        | 'base_draft'
        | 'source_snapshot'
        | 'sequence_strategy';
    }

    interface AiDraftStepStrategySnapshot {
      taskDescription: string;
      newValue: string;
      wordRange: {
        min: number;
        max: number;
      };
      requiredFactGroups: string[];
    }

    interface AiDraftSnapshot {
      productLineId: string;
      productLineName: string;
      stepIndex: AiWritingStepIndex;
      writingConfig: ProductLineAiWritingConfig;
      sourceSnapshot?: Record<string, unknown> | null;
      stepStrategy?: AiDraftStepStrategySnapshot | null;
      reason: string;
      riskNotes: string[];
      selectedModules?: AiDraftSelectedModuleSnapshot[];
      publicFacts?: AiDraftPublicFactSnapshot[];
      usedAngles?: string[];
      usedFacts?: string[];
      nextReviewHints?: string[];
      qualityFlags?: string[];
      polishChanges?: string[];
      generatedAt: string;
    }

    interface AiDraftMetadata {
      generated: true;
      reason: string;
      riskNotes: string[];
      snapshot: AiDraftSnapshot;
    }

    type AiDraftTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

    type AiDraftTaskItemStatus = 'pending' | 'running' | 'retrying' | 'succeeded' | 'skipped' | 'failed';

    type AiDraftTaskItemFailureType = 'retryable' | 'business_skip' | 'fatal';

    interface AiDraftTaskProgressState {
      currentItemId?: string | null;
      recentRetryableFailureCount?: number;
      effectiveConcurrencyReason?: string | null;
    }

    interface AiDraftTaskResultSummary {
      requestedCount: number;
      successCount: number;
      skippedCount: number;
      failedCount: number;
    }

    interface AiDraftTaskItemMetadata {
      generatedMessageId?: string | null;
      aiDraft?: unknown | null;
      nextRetryAt?: string | null;
    }

    interface AiDraftTaskRecord {
      id: string;
      organizationId: string;
      organizationRole: string | null;
      ownerUserId: string;
      ownerUserName: string | null;
      status: AiDraftTaskStatus;
      runVersion: number;
      bullJobId: string | null;
      requestedCount: number;
      successCount: number;
      skippedCount: number;
      failedCount: number;
      retryingCount: number;
      runningCount: number;
      pendingCount: number;
      effectiveConcurrency: number;
      maxAttempts: number;
      failureReason: string | null;
      progressState: AiDraftTaskProgressState | null;
      resultSummary: AiDraftTaskResultSummary | null;
      readAt: string | null;
      notifiedAt: string | null;
      startedAt: string | null;
      finishedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface AiDraftTaskItemRecord {
      id: string;
      taskId: string;
      organizationId: string;
      ownerUserId: string;
      enrollmentId: string;
      messageId: string | null;
      contactId: string | null;
      accountId: string | null;
      productLineId: string | null;
      stepIndex: number;
      status: AiDraftTaskItemStatus;
      attemptCount: number;
      maxAttempts: number;
      failureType: AiDraftTaskItemFailureType | null;
      failureReason: string | null;
      draftSubject: string | null;
      draftBodyText: string | null;
      metadata: AiDraftTaskItemMetadata | null;
      startedAt: string | null;
      finishedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface AiDraftTaskDetail {
      task: AiDraftTaskRecord;
      items: AiDraftTaskItemRecord[];
    }

    interface AiDraftTaskReadResult {
      task: AiDraftTaskRecord;
    }

    interface CreateAiDraftTaskPayload {
      enrollmentIds: string[];
    }

    interface CreateFirstOutreachAiDraftTaskPayload {
      targets: Array<{
        accountId: string;
        contactId: string;
      }>;
      productLineId?: string;
      mailboxId: string;
      policyId?: string;
    }

    type AiDraftTaskList = Api.Common.PaginatingQueryRecord<AiDraftTaskRecord>;

    interface AiDraftQueueConfigRecord {
      configKey: string;
      itemConcurrency: number;
      maxItemConcurrency: number;
      maxActiveTasksPerUser: number;
      maxActiveTasksPerOrg: number;
      maxAttempts: number;
      retryBackoffSeconds: number[] | null;
      updatedById: string | null;
      updatedByName: string | null;
      updatedAt: string;
    }

    interface AiDraftQueueConfigPayload {
      itemConcurrency?: number;
      maxItemConcurrency?: number;
      maxActiveTasksPerUser?: number;
      maxActiveTasksPerOrg?: number;
      maxAttempts?: number;
      retryBackoffSeconds?: number[];
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

    type WorkbenchTaskType = 'ai_leads' | 'ai_draft' | 'send';

    interface WorkbenchTodayStats {
      sentCount: number;
      scheduledTodayCount: number;
      scheduledTomorrowCount: number;
      queuedCount: number;
      failedCount: number;
      pendingReplyCount: number;
      totalReplyCount: number;
      draftReviewCount: number;
      firstDraftReviewCount: number;
      followUpDraftReviewCount: number;
      riskyDraftReviewCount: number;
      issueCount: number;
      sendFailedCount: number;
      mailboxIssueCount: number;
      missingContactCount: number;
      emailVerificationPendingCount: number;
      riskyEmailCount: number;
      aiLeadTaskPendingCount: number;
    }

    interface WorkbenchYesterdayStats {
      sentCount: number;
      totalReplyCount: number;
    }

    interface WorkbenchTrendPoint {
      date: string;
      sentCount: number;
      replyCount: number;
    }

    interface WorkbenchRunningTask {
      id: string;
      type: WorkbenchTaskType;
      title: string;
      status: string;
      totalCount: number;
      completedCount: number;
      failedCount: number;
      pendingCount: number;
      progressPercent?: number;
      routePath: string;
    }

    interface WorkbenchOverview {
      generatedAt: string;
      today: WorkbenchTodayStats;
      yesterday: WorkbenchYesterdayStats;
      trend: WorkbenchTrendPoint[];
      runningTasks: WorkbenchRunningTask[];
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
      openTracking?: MessageOpenTrackingRecord | null;
      createdAt: string;
      updatedAt: string;
    }

    type TrackingIpReliability = 'direct' | 'proxy' | 'unknown';
    type TrackingOpenConfidence = 'high' | 'medium' | 'low';

    interface TrackingOpenInsight {
      clientName: string | null;
      clientType: string | null;
      confidence: TrackingOpenConfidence;
      deviceBrand: string | null;
      deviceLabel: string;
      deviceModel: string | null;
      deviceType: string | null;
      ipAddress: string | null;
      ipReliability: TrackingIpReliability;
      osName: string | null;
      osVersion: string | null;
      proxyProvider: string | null;
      reliabilityNote: string;
      userAgent: string | null;
    }

    interface MessageOpenTrackingRecord {
      eventId: string;
      openCount: number;
      firstOpenedAt: string;
      lastOpenedAt: string;
      lastUserAgent: string | null;
      lastIpAddress: string | null;
      insight: TrackingOpenInsight;
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
      messageType: 'customer_reply' | 'bounce' | 'unsubscribe_hint' | 'unsubscribe_review_pending';
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

    interface InboxUnsubscribeConfirmResult extends InboxThreadDetail {
      message: InboxMessageRecord;
    }

    interface SendQueueReconcileResult {
      scannedCount: number;
      repairedCount: number;
      skippedCount: number;
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
      currentStep?: number;
      status?: SequenceEnrollmentStatus;
      todoType?: SequenceReviewTodoType;
      messageStatus?: MessageStatus;
      dateScope?: 'today';
      createdAtScope?: SequenceReviewCreatedAtScope;
    }

    type SequenceReviewCreatedAtScope = 'today' | 'yesterday' | 'last_3_days' | 'last_7_days' | 'last_30_days';

    interface InboxThreadSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: InboxThreadStatus;
      mailboxId?: string;
      accountId?: string;
      contactId?: string;
    }

    interface SequenceReviewFilterModel {
      keyword: string;
      currentStep: number | null;
      status: SequenceEnrollmentStatus | null;
      todoType: SequenceReviewTodoType | null;
      messageStatus: MessageStatus | null;
      dateScope: 'today' | null;
      createdAtScope: SequenceReviewCreatedAtScope | null;
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

    type MessageReturnToEditResult = MessageSendStartResult;
    type MessageRetrySendResult = MessageSendStartResult;

    interface SequenceStopResult {
      enrollment: SequenceEnrollmentRecord;
      message: MessageRecord | null;
      account: LeadRecord;
      event: LeadTimelineEvent;
    }

    type SequenceResumeResult = SequenceStopResult;

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
