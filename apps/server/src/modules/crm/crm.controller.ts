import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { AppConfigService } from '../app-config/app-config.service';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthService } from '../auth/auth.service';
import type { UserInfo } from '../auth/auth.types';
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
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CrmService) private readonly crmService: CrmService,
    @Optional()
    @Inject(CrmGmailWatchService)
    private readonly gmailWatchService?: CrmGmailWatchService,
    @Optional()
    @Inject(AppConfigService)
    private readonly appConfigService?: AppConfigService
  ) {}

  @Get('accounts')
  async listAccounts(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmAccountQueryDto) {
    return ok(await this.crmService.listAccounts(await this.requireUserContext(authorization, currentUser), query));
  }

  @Post('accounts/import-lead')
  async importLead(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: ImportCrmLeadDto) {
    return ok(
      await this.crmService.importAccountFromLead(
        { ...dto, sourceTaskId: null },
        await this.requireUserContext(authorization, currentUser)
      )
    );
  }

  @Get('accounts/:id')
  async getAccountDetail(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getAccountDetail(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('accounts/:id/status')
  async updateAccountStatus(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmAccountStatusDto
  ) {
    return ok(await this.crmService.updateAccountStatus(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('accounts/:id/notes')
  async addAccountNote(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: CreateCrmAccountNoteDto
  ) {
    return ok(await this.crmService.addAccountNote(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('accounts/:id/archive')
  async archiveAccount(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: ArchiveCrmAccountDto
  ) {
    return ok(await this.crmService.archiveAccount(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('accounts/:id/restore')
  async restoreAccount(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.restoreAccount(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('contacts/:id/verify-email')
  async verifyContactEmail(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.verifyContactEmail(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('global-config')
  async getGlobalConfig(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    await this.requireSuperUserContext(authorization, currentUser);

    return ok(await this.crmService.getGlobalConfig());
  }

  @Post('global-config')
  async saveGlobalConfig(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: SaveCrmGlobalConfigDto) {
    return ok(await this.crmService.saveGlobalConfig(dto, await this.requireSuperUserContext(authorization, currentUser)));
  }

  @Get('ai-draft-queue-config')
  async getAiDraftQueueConfig(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    await this.requireSuperUserContext(authorization, currentUser);

    return ok(await this.crmService.getAiDraftQueueConfig());
  }

  @Patch('ai-draft-queue-config')
  async saveAiDraftQueueConfig(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: UpdateCrmAiDraftQueueConfigDto
  ) {
    return ok(await this.crmService.saveAiDraftQueueConfig(dto, await this.requireSuperUserContext(authorization, currentUser)));
  }

  @Post('operations/send-queue/reconcile')
  async reconcileSendQueue(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.reconcileSendQueue({}, await this.requireSuperUserContext(authorization, currentUser)));
  }

  @Get('send-preference')
  async getSendPreference(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.getSendPreference(await this.requireUserContext(authorization, currentUser)));
  }

  @Post('send-preference')
  async saveSendPreference(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: SaveCrmSendPreferenceDto) {
    return ok(await this.crmService.saveSendPreference(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('organization-config')
  async getOrganizationConfig(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.getOrganizationConfig(await this.requireUserContext(authorization, currentUser)));
  }

  @Post('organization-config')
  async saveOrganizationConfig(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: SaveCrmOrganizationConfigDto
  ) {
    return ok(await this.crmService.saveOrganizationConfig(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('blacklist-entries')
  async listBlacklistEntries(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmBlacklistQueryDto) {
    return ok(await this.crmService.listBlacklistEntries(await this.requireUserContext(authorization, currentUser), query));
  }

  @Delete('blacklist-entries/:id')
  async removeBlacklistEntry(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: RemoveCrmBlacklistEntryDto
  ) {
    return ok(await this.crmService.removeBlacklistEntry(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('mailboxes/mock-authorize')
  async mockAuthorizeMailbox(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: MockAuthorizeCrmMailboxDto) {
    const context = await this.requireUserContext(authorization, currentUser);
    this.requireMockEndpointsEnabled(context);

    return ok(await this.crmService.mockAuthorizeMailbox(dto, context));
  }

  @Post('mailboxes/gmail/oauth-url')
  async createGmailOAuthUrl(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(this.crmService.createGmailOAuthAuthorizationUrl(await this.requireUserContext(authorization, currentUser)));
  }

  @Post('mailboxes/gmail/oauth-callback')
  async completeGmailOAuthCallback(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: CompleteCrmGmailOAuthDto
  ) {
    return ok(await this.crmService.completeGmailOAuthAuthorization(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('mailboxes')
  async listMailboxes(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmMailboxQueryDto) {
    return ok(await this.crmService.listMailboxes(await this.requireUserContext(authorization, currentUser), query));
  }

  @Patch('mailboxes/:id/pause')
  async pauseMailbox(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.pauseMailbox(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('mailboxes/:id/resume')
  async resumeMailbox(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.resumeMailbox(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('mailboxes/:id/renew-watch')
  async renewMailboxWatch(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.gmailWatchService!.renewMailboxWatch(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('mailboxes/:id/sync-now')
  async syncMailboxNow(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.gmailWatchService!.syncMailboxNow(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('product-lines')
  async listProductLines(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmProductLineQueryDto) {
    return ok(await this.crmService.listProductLines(await this.requireUserContext(authorization, currentUser), query));
  }

  @Post('product-lines')
  async createProductLine(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: CreateCrmProductLineDto) {
    return ok(await this.crmService.createProductLine(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('product-lines/:id')
  async updateProductLine(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmProductLineDto
  ) {
    return ok(await this.crmService.updateProductLine(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('product-lines/:id/archive')
  async archiveProductLine(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archiveProductLine(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('product-lines/:id/ai-prompt-versions')
  async listProductLineAiPromptVersions(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.listProductLineAiPromptVersions(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('product-lines/:id/ai-prompt-versions/:versionId/restore')
  async restoreProductLineAiPromptVersion(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(
      await this.crmService.restoreProductLineAiPromptVersion(id, versionId, await this.requireUserContext(authorization, currentUser))
    );
  }

  @Get('persona-profiles')
  async listPersonaProfiles(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmPersonaProfileQueryDto) {
    return ok(await this.crmService.listPersonaProfiles(await this.requireUserContext(authorization, currentUser), query));
  }

  @Post('persona-profiles')
  async createPersonaProfile(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: CreateCrmPersonaProfileDto) {
    return ok(await this.crmService.createPersonaProfile(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('persona-profiles/:id')
  async updatePersonaProfile(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmPersonaProfileDto
  ) {
    return ok(await this.crmService.updatePersonaProfile(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('persona-profiles/:id/archive')
  async archivePersonaProfile(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archivePersonaProfile(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('persona-profiles/:id/default')
  async setDefaultPersonaProfile(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.setDefaultPersonaProfile(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('email-template-groups')
  async listEmailTemplateGroups(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Query() query: CrmEmailTemplateQueryDto
  ) {
    return ok(await this.crmService.listEmailTemplateGroups(await this.requireUserContext(authorization, currentUser), query));
  }

  @Post('email-template-groups')
  async createEmailTemplateGroup(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: CreateCrmEmailTemplateDto) {
    return ok(await this.crmService.createEmailTemplateGroup(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('email-template-groups/:id')
  async updateEmailTemplateGroup(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmEmailTemplateDto
  ) {
    return ok(await this.crmService.updateEmailTemplateGroup(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('email-template-groups/:id/archive')
  async archiveEmailTemplateGroup(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archiveEmailTemplateGroup(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('email-template-groups/:id/default')
  async setDefaultEmailTemplateGroup(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.setDefaultEmailTemplateGroup(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('template-defaults')
  async getTemplateDefaults(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.getTemplateDefaults(await this.requireUserContext(authorization, currentUser)));
  }

  @Get('strategy-stats')
  async listStrategyStats(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.listStrategyStats(await this.requireUserContext(authorization, currentUser)));
  }

  @Get('workbench/overview')
  async getWorkbenchOverview(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.getWorkbenchOverview(await this.requireUserContext(authorization, currentUser)));
  }

  @Get('sequence-policies')
  async listSequencePolicies(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmSequencePolicyQueryDto) {
    return ok(await this.crmService.listSequencePolicies(await this.requireUserContext(authorization, currentUser), query));
  }

  @Post('sequence-policies')
  async createSequencePolicy(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: CreateCrmSequencePolicyDto) {
    return ok(await this.crmService.createSequencePolicy(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('sequence-policies/:id')
  async updateSequencePolicy(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmSequencePolicyDto
  ) {
    return ok(await this.crmService.updateSequencePolicy(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('sequence-policies/:id/archive')
  async archiveSequencePolicy(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.archiveSequencePolicy(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-policies/:id/default')
  async setDefaultSequencePolicy(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.setDefaultSequencePolicy(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('sequence-review-items')
  async listSequenceReviewItems(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Query() query: CrmSequenceReviewQueryDto
  ) {
    return ok(await this.crmService.listSequenceReviewItems(await this.requireUserContext(authorization, currentUser), query));
  }

  @Post('sequence-review-items')
  async createSequenceReviewItem(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: CreateCrmSequenceReviewItemDto
  ) {
    return ok(await this.crmService.createSequenceReviewItem(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('sequence-review-items/:id')
  async getSequenceReviewItem(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getSequenceReviewItem(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-review-items/batch-generate-next-draft')
  async batchGenerateNextDrafts(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchGenerateNextDrafts(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('ai-draft-tasks')
  async createAiDraftTask(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: CreateCrmAiDraftTaskDto) {
    return ok(await this.crmService.createAiDraftTask(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('ai-draft-tasks/current')
  async getCurrentAiDraftTask(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    return ok(await this.crmService.getCurrentAiDraftTask(await this.requireUserContext(authorization, currentUser)));
  }

  @Get('ai-draft-tasks')
  async listAiDraftTasks(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmAiDraftTaskQueryDto) {
    return ok(await this.crmService.listAiDraftTasks(await this.requireUserContext(authorization, currentUser), query));
  }

  @Get('ai-draft-tasks/:id')
  async getAiDraftTaskDetail(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getAiDraftTaskDetail(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('ai-draft-tasks/:id/retry-failed')
  async retryFailedAiDraftTask(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.retryFailedAiDraftTask(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('ai-draft-tasks/:id/cancel')
  async cancelAiDraftTask(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.cancelAiDraftTask(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('ai-draft-tasks/:id/read')
  async markAiDraftTaskRead(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.markAiDraftTaskRead(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-review-items/batch-approve-draft')
  async batchApproveMessageDrafts(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchApproveMessageDrafts(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-review-items/batch-stop')
  async batchStopSequenceEnrollments(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchStopSequenceEnrollments(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('ai-drafts/preview')
  async previewAiDraft(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Body() dto: PreviewCrmAiDraftDto) {
    return ok(await this.crmService.previewAiDraft(dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('messages/:id/draft')
  async updateMessageDraft(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmMessageDraftDto
  ) {
    return ok(await this.crmService.updateMessageDraft(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('messages/:id/regenerate-ai-draft')
  async regenerateMessageAiDraft(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.regenerateMessageAiDraft(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('messages/:id/approve')
  async approveMessageDraft(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.approveMessageDraft(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('messages/:id/draft-versions')
  async listMessageDraftVersions(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.listMessageDraftVersions(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('messages/:id/draft-versions/:versionId/restore')
  async restoreMessageDraftVersion(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(await this.crmService.restoreMessageDraftVersion(id, versionId, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-review-items/:id/start-send')
  async startFirstMessageSend(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.startFirstMessageSend(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-review-items/:id/generate-next-draft')
  async generateNextDraft(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.generateNextDraft(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('sequence-review-items/:id/stop')
  async stopSequenceEnrollment(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.stopSequenceEnrollment(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Get('inbox-threads')
  async listInboxThreads(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Query() query: CrmInboxThreadQueryDto) {
    return ok(await this.crmService.listInboxThreads(await this.requireUserContext(authorization, currentUser), query));
  }

  @Get('inbox-threads/:id')
  async getInboxThread(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.getInboxThread(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('inbox-threads/:id/status')
  async updateInboxThreadStatus(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmInboxThreadStatusDto
  ) {
    return ok(await this.crmService.updateInboxThreadStatus(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('inbox-threads/:id/reply')
  async replyInboxThread(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: ReplyCrmInboxThreadDto
  ) {
    return ok(await this.crmService.replyInboxThread(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('inbox-threads/:id/ai-reply-polish')
  async polishInboxReplyDraft(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: PolishCrmInboxReplyDraftDto
  ) {
    return ok(await this.crmService.polishInboxReplyDraft(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Patch('inbox-threads/:id/reply-draft')
  async saveInboxReplyDraft(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: SaveCrmInboxReplyDraftDto
  ) {
    return ok(await this.crmService.saveInboxReplyDraft(id, dto, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('inbox-messages/:id/confirm-unsubscribe')
  async confirmInboxMessageUnsubscribe(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null, @Param('id') id: string) {
    return ok(await this.crmService.confirmInboxMessageUnsubscribe(id, await this.requireUserContext(authorization, currentUser)));
  }

  @Post('messages/:id/mock-reply')
  async mockCustomerReply(
    @Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: MockCrmReplyDto
  ) {
    const context = await this.requireUserContext(authorization, currentUser);
    this.requireMockEndpointsEnabled(context);

    return ok(await this.crmService.mockCustomerReply(id, dto, context));
  }

  private requireMockEndpointsEnabled(context: CrmUserContext) {
    const mockEndpointsEnabled =
      this.appConfigService?.config.crmEnableMockEndpoints ??
      (process.env.NODE_ENV !== 'production' && process.env.CRM_ENABLE_MOCK_ENDPOINTS === 'true');

    if (!mockEndpointsEnabled) {
      throw new ForbiddenException('CRM mock 接口未启用');
    }

    if (!context.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权使用 CRM mock 接口');
    }
  }

  private async requireUserContext(authorization: string, currentUser: UserInfo | null): Promise<CrmUserContext> {
    const user = await this.requireUser(authorization, currentUser);

    return {
      userId: user.userId,
      userName: user.userName,
      roles: user.roles,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole
    };
  }

  private async requireSuperUserContext(authorization: string, currentUser: UserInfo | null): Promise<CrmUserContext> {
    const context = await this.requireUserContext(authorization, currentUser);

    if (!context.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权维护 CRM 全局配置');
    }

    return context;
  }

  private async requireUser(authorization: string, currentUser: UserInfo | null): Promise<UserInfo> {
    const user = currentUser || (await this.authService.getUserByAccessToken(this.extractBearerToken(authorization)));

    if (!user?.userId) {
      throw new UnauthorizedException('请先登录');
    }

    return user;
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
