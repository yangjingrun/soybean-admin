import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Optional,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { assertSuper } from '../../shared/permission-policy';
import { requireRequestUserContext } from '../../shared/request-context';
import { AppConfigService } from '../app-config/app-config.service';
import { CurrentContext } from '../auth/auth.decorators';
import { CrmService } from './crm.service';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { ArchiveCrmAccountDto } from './dto/archive-crm-account.dto';
import { BatchCrmSequenceReviewItemsDto } from './dto/batch-crm-sequence-review-items.dto';
import { CompleteCrmGmailOAuthDto } from './dto/complete-crm-gmail-oauth.dto';
import { CreateCrmAccountNoteDto } from './dto/create-crm-account-note.dto';
import { CrmAccountQueryDto } from './dto/crm-account-query.dto';
import { CrmBlacklistQueryDto } from './dto/crm-blacklist-query.dto';
import { CrmAiDraftTaskQueryDto } from './dto/crm-ai-draft-task-query.dto';
import { CrmInboxThreadQueryDto } from './dto/crm-inbox-thread-query.dto';
import { CrmMailboxQueryDto } from './dto/crm-mailbox-query.dto';
import { CrmEmailTemplateQueryDto } from './dto/crm-email-template-query.dto';
import { CrmPersonaProfileQueryDto } from './dto/crm-persona-profile-query.dto';
import { CrmProductLineQueryDto } from './dto/crm-product-line-query.dto';
import { CrmSequencePolicyQueryDto } from './dto/crm-sequence-policy-query.dto';
import { CrmSequenceReviewQueryDto } from './dto/crm-sequence-review-query.dto';
import { CreateCrmAiDraftTaskDto } from './dto/create-crm-ai-draft-task.dto';
import { CreateCrmEmailTemplateDto } from './dto/create-crm-email-template.dto';
import { CreateCrmPersonaProfileDto } from './dto/create-crm-persona-profile.dto';
import { CreateCrmSequenceReviewItemDto } from './dto/create-crm-sequence-review-item.dto';
import { CreateCrmProductLineDto } from './dto/create-crm-product-line.dto';
import { CreateCrmSequencePolicyDto } from './dto/create-crm-sequence-policy.dto';
import { ImportCrmLeadDto } from './dto/import-crm-lead.dto';
import { MockAuthorizeCrmMailboxDto } from './dto/mock-authorize-crm-mailbox.dto';
import { MockCrmReplyDto } from './dto/mock-crm-reply.dto';
import { PolishCrmInboxReplyDraftDto } from './dto/polish-crm-inbox-reply-draft.dto';
import { PreviewCrmAiDraftDto } from './dto/preview-crm-ai-draft.dto';
import { ReplyCrmInboxThreadDto } from './dto/reply-crm-inbox-thread.dto';
import { RemoveCrmBlacklistEntryDto } from './dto/remove-crm-blacklist-entry.dto';
import { SaveCrmGlobalConfigDto } from './dto/save-crm-global-config.dto';
import { SaveCrmInboxReplyDraftDto } from './dto/save-crm-inbox-reply-draft.dto';
import { SaveCrmOrganizationConfigDto } from './dto/save-crm-organization-config.dto';
import { SaveCrmSendPreferenceDto } from './dto/save-crm-send-preference.dto';
import { UpdateCrmAccountStatusDto } from './dto/update-crm-account-status.dto';
import { UpdateCrmAiDraftQueueConfigDto } from './dto/update-crm-ai-draft-queue-config.dto';
import { UpdateCrmInboxThreadStatusDto } from './dto/update-crm-inbox-thread-status.dto';
import { UpdateCrmMessageDraftDto } from './dto/update-crm-message-draft.dto';
import { UpdateCrmEmailTemplateDto } from './dto/update-crm-email-template.dto';
import { UpdateCrmPersonaProfileDto } from './dto/update-crm-persona-profile.dto';
import { UpdateCrmProductLineDto } from './dto/update-crm-product-line.dto';
import { UpdateCrmSequencePolicyDto } from './dto/update-crm-sequence-policy.dto';
import type { CrmUserContext } from './crm.types';

@Controller('crm')
export class CrmController {
  constructor(
    @Inject(CrmService) private readonly crmService: CrmService,
    @Optional()
    @Inject(CrmGmailWatchService)
    private readonly gmailWatchService?: CrmGmailWatchService,
    @Optional()
    @Inject(AppConfigService)
    private readonly appConfigService?: AppConfigService
  ) {}

  @Get('accounts')
  async listAccounts(@CurrentContext() context: CrmUserContext | null = null, @Query() query: CrmAccountQueryDto) {
    return ok(await this.crmService.listAccounts(this.requireUserContext(context), query));
  }

  @Post('accounts/import-lead')
  async importLead(@CurrentContext() context: CrmUserContext | null = null, @Body() dto: ImportCrmLeadDto) {
    return ok(
      await this.crmService.importAccountFromLead({ ...dto, sourceTaskId: null }, this.requireUserContext(context))
    );
  }

  @Get('accounts/:id')
  async getAccountDetail(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getAccountDetail(id, this.requireUserContext(context)));
  }

  @Patch('accounts/:id/status')
  async updateAccountStatus(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmAccountStatusDto
  ) {
    return ok(await this.crmService.updateAccountStatus(id, dto, this.requireUserContext(context)));
  }

  @Post('accounts/:id/notes')
  async addAccountNote(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: CreateCrmAccountNoteDto
  ) {
    return ok(await this.crmService.addAccountNote(id, dto, this.requireUserContext(context)));
  }

  @Post('accounts/:id/archive')
  async archiveAccount(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: ArchiveCrmAccountDto
  ) {
    return ok(await this.crmService.archiveAccount(id, dto, this.requireUserContext(context)));
  }

  @Post('accounts/:id/restore')
  async restoreAccount(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.restoreAccount(id, this.requireUserContext(context)));
  }

  @Post('contacts/:id/verify-email')
  async verifyContactEmail(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.verifyContactEmail(id, this.requireUserContext(context)));
  }

  @Get('global-config')
  async getGlobalConfig(@CurrentContext() context: CrmUserContext | null = null) {
    this.requireSuperUserContext(context);

    return ok(await this.crmService.getGlobalConfig());
  }

  @Post('global-config')
  async saveGlobalConfig(@CurrentContext() context: CrmUserContext | null = null, @Body() dto: SaveCrmGlobalConfigDto) {
    return ok(await this.crmService.saveGlobalConfig(dto, this.requireSuperUserContext(context)));
  }

  @Get('ai-draft-queue-config')
  async getAiDraftQueueConfig(@CurrentContext() context: CrmUserContext | null = null) {
    this.requireSuperUserContext(context);

    return ok(await this.crmService.getAiDraftQueueConfig());
  }

  @Patch('ai-draft-queue-config')
  async saveAiDraftQueueConfig(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: UpdateCrmAiDraftQueueConfigDto
  ) {
    return ok(await this.crmService.saveAiDraftQueueConfig(dto, this.requireSuperUserContext(context)));
  }

  @Post('operations/send-queue/reconcile')
  async reconcileSendQueue(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.reconcileSendQueue({}, this.requireSuperUserContext(context)));
  }

  @Get('send-preference')
  async getSendPreference(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.getSendPreference(this.requireUserContext(context)));
  }

  @Post('send-preference')
  async saveSendPreference(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: SaveCrmSendPreferenceDto
  ) {
    return ok(await this.crmService.saveSendPreference(dto, this.requireUserContext(context)));
  }

  @Get('organization-config')
  async getOrganizationConfig(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.getOrganizationConfig(this.requireUserContext(context)));
  }

  @Post('organization-config')
  async saveOrganizationConfig(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: SaveCrmOrganizationConfigDto
  ) {
    return ok(await this.crmService.saveOrganizationConfig(dto, this.requireUserContext(context)));
  }

  @Get('blacklist-entries')
  async listBlacklistEntries(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmBlacklistQueryDto
  ) {
    return ok(await this.crmService.listBlacklistEntries(this.requireUserContext(context), query));
  }

  @Delete('blacklist-entries/:id')
  async removeBlacklistEntry(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: RemoveCrmBlacklistEntryDto
  ) {
    return ok(await this.crmService.removeBlacklistEntry(id, dto, this.requireUserContext(context)));
  }

  @Post('mailboxes/mock-authorize')
  async mockAuthorizeMailbox(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: MockAuthorizeCrmMailboxDto
  ) {
    const requestContext = this.requireUserContext(context);
    this.requireMockEndpointsEnabled(requestContext);

    return ok(await this.crmService.mockAuthorizeMailbox(dto, requestContext));
  }

  @Post('mailboxes/gmail/oauth-url')
  async createGmailOAuthUrl(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(this.crmService.createGmailOAuthAuthorizationUrl(this.requireUserContext(context)));
  }

  @Post('mailboxes/gmail/oauth-callback')
  async completeGmailOAuthCallback(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CompleteCrmGmailOAuthDto
  ) {
    return ok(await this.crmService.completeGmailOAuthAuthorization(dto, this.requireUserContext(context)));
  }

  @Get('mailboxes')
  async listMailboxes(@CurrentContext() context: CrmUserContext | null = null, @Query() query: CrmMailboxQueryDto) {
    return ok(await this.crmService.listMailboxes(this.requireUserContext(context), query));
  }

  @Patch('mailboxes/:id/pause')
  async pauseMailbox(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.pauseMailbox(id, this.requireUserContext(context)));
  }

  @Patch('mailboxes/:id/resume')
  async resumeMailbox(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.resumeMailbox(id, this.requireUserContext(context)));
  }

  @Post('mailboxes/:id/renew-watch')
  async renewMailboxWatch(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.gmailWatchService!.renewMailboxWatch(id, this.requireUserContext(context)));
  }

  @Post('mailboxes/:id/sync-now')
  async syncMailboxNow(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.gmailWatchService!.syncMailboxNow(id, this.requireUserContext(context)));
  }

  @Get('product-lines')
  async listProductLines(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmProductLineQueryDto
  ) {
    return ok(await this.crmService.listProductLines(this.requireUserContext(context), query));
  }

  @Post('product-lines')
  async createProductLine(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmProductLineDto
  ) {
    return ok(await this.crmService.createProductLine(dto, this.requireUserContext(context)));
  }

  @Patch('product-lines/:id')
  async updateProductLine(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmProductLineDto
  ) {
    return ok(await this.crmService.updateProductLine(id, dto, this.requireUserContext(context)));
  }

  @Patch('product-lines/:id/archive')
  async archiveProductLine(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archiveProductLine(id, this.requireUserContext(context)));
  }

  @Get('product-lines/:id/ai-prompt-versions')
  async listProductLineAiPromptVersions(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string
  ) {
    return ok(await this.crmService.listProductLineAiPromptVersions(id, this.requireUserContext(context)));
  }

  @Post('product-lines/:id/ai-prompt-versions/:versionId/restore')
  async restoreProductLineAiPromptVersion(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(await this.crmService.restoreProductLineAiPromptVersion(id, versionId, this.requireUserContext(context)));
  }

  @Get('persona-profiles')
  async listPersonaProfiles(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmPersonaProfileQueryDto
  ) {
    return ok(await this.crmService.listPersonaProfiles(this.requireUserContext(context), query));
  }

  @Post('persona-profiles')
  async createPersonaProfile(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmPersonaProfileDto
  ) {
    return ok(await this.crmService.createPersonaProfile(dto, this.requireUserContext(context)));
  }

  @Patch('persona-profiles/:id')
  async updatePersonaProfile(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmPersonaProfileDto
  ) {
    return ok(await this.crmService.updatePersonaProfile(id, dto, this.requireUserContext(context)));
  }

  @Patch('persona-profiles/:id/archive')
  async archivePersonaProfile(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archivePersonaProfile(id, this.requireUserContext(context)));
  }

  @Post('persona-profiles/:id/default')
  async setDefaultPersonaProfile(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.setDefaultPersonaProfile(id, this.requireUserContext(context)));
  }

  @Get('email-template-groups')
  async listEmailTemplateGroups(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmEmailTemplateQueryDto
  ) {
    return ok(await this.crmService.listEmailTemplateGroups(this.requireUserContext(context), query));
  }

  @Post('email-template-groups')
  async createEmailTemplateGroup(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmEmailTemplateDto
  ) {
    return ok(await this.crmService.createEmailTemplateGroup(dto, this.requireUserContext(context)));
  }

  @Patch('email-template-groups/:id')
  async updateEmailTemplateGroup(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmEmailTemplateDto
  ) {
    return ok(await this.crmService.updateEmailTemplateGroup(id, dto, this.requireUserContext(context)));
  }

  @Patch('email-template-groups/:id/archive')
  async archiveEmailTemplateGroup(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archiveEmailTemplateGroup(id, this.requireUserContext(context)));
  }

  @Post('email-template-groups/:id/default')
  async setDefaultEmailTemplateGroup(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.setDefaultEmailTemplateGroup(id, this.requireUserContext(context)));
  }

  @Get('template-defaults')
  async getTemplateDefaults(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.getTemplateDefaults(this.requireUserContext(context)));
  }

  @Get('strategy-stats')
  async listStrategyStats(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.listStrategyStats(this.requireUserContext(context)));
  }

  @Get('workbench/overview')
  async getWorkbenchOverview(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.getWorkbenchOverview(this.requireUserContext(context)));
  }

  @Get('sequence-policies')
  async listSequencePolicies(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmSequencePolicyQueryDto
  ) {
    return ok(await this.crmService.listSequencePolicies(this.requireUserContext(context), query));
  }

  @Post('sequence-policies')
  async createSequencePolicy(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmSequencePolicyDto
  ) {
    return ok(await this.crmService.createSequencePolicy(dto, this.requireUserContext(context)));
  }

  @Patch('sequence-policies/:id')
  async updateSequencePolicy(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmSequencePolicyDto
  ) {
    return ok(await this.crmService.updateSequencePolicy(id, dto, this.requireUserContext(context)));
  }

  @Patch('sequence-policies/:id/archive')
  async archiveSequencePolicy(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archiveSequencePolicy(id, this.requireUserContext(context)));
  }

  @Post('sequence-policies/:id/default')
  async setDefaultSequencePolicy(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.setDefaultSequencePolicy(id, this.requireUserContext(context)));
  }

  @Get('sequence-review-items')
  async listSequenceReviewItems(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmSequenceReviewQueryDto
  ) {
    return ok(await this.crmService.listSequenceReviewItems(this.requireUserContext(context), query));
  }

  @Post('sequence-review-items')
  async createSequenceReviewItem(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmSequenceReviewItemDto
  ) {
    return ok(await this.crmService.createSequenceReviewItem(dto, this.requireUserContext(context)));
  }

  @Get('sequence-review-items/:id')
  async getSequenceReviewItem(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getSequenceReviewItem(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/batch-generate-next-draft')
  async batchGenerateNextDrafts(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchGenerateNextDrafts(dto, this.requireUserContext(context)));
  }

  @Post('ai-draft-tasks')
  async createAiDraftTask(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmAiDraftTaskDto
  ) {
    return ok(await this.crmService.createAiDraftTask(dto, this.requireUserContext(context)));
  }

  @Get('ai-draft-tasks/current')
  async getCurrentAiDraftTask(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.crmService.getCurrentAiDraftTask(this.requireUserContext(context)));
  }

  @Get('ai-draft-tasks')
  async listAiDraftTasks(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmAiDraftTaskQueryDto
  ) {
    return ok(await this.crmService.listAiDraftTasks(this.requireUserContext(context), query));
  }

  @Get('ai-draft-tasks/:id')
  async getAiDraftTaskDetail(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getAiDraftTaskDetail(id, this.requireUserContext(context)));
  }

  @Post('ai-draft-tasks/:id/retry-failed')
  async retryFailedAiDraftTask(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.retryFailedAiDraftTask(id, this.requireUserContext(context)));
  }

  @Post('ai-draft-tasks/:id/cancel')
  async cancelAiDraftTask(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.cancelAiDraftTask(id, this.requireUserContext(context)));
  }

  @Patch('ai-draft-tasks/:id/read')
  async markAiDraftTaskRead(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.markAiDraftTaskRead(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/batch-approve-draft')
  async batchApproveMessageDrafts(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchApproveMessageDrafts(dto, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/batch-stop')
  async batchStopSequenceEnrollments(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchStopSequenceEnrollments(dto, this.requireUserContext(context)));
  }

  @Post('ai-drafts/preview')
  async previewAiDraft(@CurrentContext() context: CrmUserContext | null = null, @Body() dto: PreviewCrmAiDraftDto) {
    return ok(await this.crmService.previewAiDraft(dto, this.requireUserContext(context)));
  }

  @Patch('messages/:id/draft')
  async updateMessageDraft(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmMessageDraftDto
  ) {
    return ok(await this.crmService.updateMessageDraft(id, dto, this.requireUserContext(context)));
  }

  @Post('messages/:id/regenerate-ai-draft')
  async regenerateMessageAiDraft(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.regenerateMessageAiDraft(id, this.requireUserContext(context)));
  }

  @Post('messages/:id/approve')
  async approveMessageDraft(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.approveMessageDraft(id, this.requireUserContext(context)));
  }

  @Get('messages/:id/draft-versions')
  async listMessageDraftVersions(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.listMessageDraftVersions(id, this.requireUserContext(context)));
  }

  @Post('messages/:id/draft-versions/:versionId/restore')
  async restoreMessageDraftVersion(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(await this.crmService.restoreMessageDraftVersion(id, versionId, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/:id/start-send')
  async startFirstMessageSend(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.startFirstMessageSend(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/:id/generate-next-draft')
  async generateNextDraft(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.generateNextDraft(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/:id/stop')
  async stopSequenceEnrollment(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.stopSequenceEnrollment(id, this.requireUserContext(context)));
  }

  @Get('inbox-threads')
  async listInboxThreads(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmInboxThreadQueryDto
  ) {
    return ok(await this.crmService.listInboxThreads(this.requireUserContext(context), query));
  }

  @Get('inbox-threads/:id')
  async getInboxThread(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getInboxThread(id, this.requireUserContext(context)));
  }

  @Patch('inbox-threads/:id/status')
  async updateInboxThreadStatus(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmInboxThreadStatusDto
  ) {
    return ok(await this.crmService.updateInboxThreadStatus(id, dto, this.requireUserContext(context)));
  }

  @Post('inbox-threads/:id/reply')
  async replyInboxThread(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: ReplyCrmInboxThreadDto
  ) {
    return ok(await this.crmService.replyInboxThread(id, dto, this.requireUserContext(context)));
  }

  @Post('inbox-threads/:id/ai-reply-polish')
  async polishInboxReplyDraft(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: PolishCrmInboxReplyDraftDto
  ) {
    return ok(await this.crmService.polishInboxReplyDraft(id, dto, this.requireUserContext(context)));
  }

  @Patch('inbox-threads/:id/reply-draft')
  async saveInboxReplyDraft(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: SaveCrmInboxReplyDraftDto
  ) {
    return ok(await this.crmService.saveInboxReplyDraft(id, dto, this.requireUserContext(context)));
  }

  @Post('inbox-messages/:id/confirm-unsubscribe')
  async confirmInboxMessageUnsubscribe(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string
  ) {
    return ok(await this.crmService.confirmInboxMessageUnsubscribe(id, this.requireUserContext(context)));
  }

  @Post('messages/:id/mock-reply')
  async mockCustomerReply(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: MockCrmReplyDto
  ) {
    const requestContext = this.requireUserContext(context);
    this.requireMockEndpointsEnabled(requestContext);

    return ok(await this.crmService.mockCustomerReply(id, dto, requestContext));
  }

  private requireMockEndpointsEnabled(context: CrmUserContext) {
    const mockEndpointsEnabled =
      this.appConfigService?.config.crmEnableMockEndpoints ??
      (process.env.NODE_ENV !== 'production' && process.env.CRM_ENABLE_MOCK_ENDPOINTS === 'true');

    if (!mockEndpointsEnabled) {
      throw new ForbiddenException('CRM mock 接口未启用');
    }

    assertSuper(context, '无权使用 CRM mock 接口');
  }

  private requireUserContext(context: CrmUserContext | null): CrmUserContext {
    return requireRequestUserContext(context);
  }

  private requireSuperUserContext(context: CrmUserContext | null): CrmUserContext {
    const requestContext = this.requireUserContext(context);
    assertSuper(requestContext, '无权维护 CRM 全局配置');

    return requestContext;
  }
}
