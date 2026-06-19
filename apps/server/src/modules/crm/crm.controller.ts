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
import { CrmInboxThreadQueryDto } from './dto/crm-inbox-thread-query.dto';
import { CrmMailboxQueryDto } from './dto/crm-mailbox-query.dto';
import { CrmEmailTemplateQueryDto } from './dto/crm-email-template-query.dto';
import { CrmPersonaProfileQueryDto } from './dto/crm-persona-profile-query.dto';
import { CrmProductLineQueryDto } from './dto/crm-product-line-query.dto';
import { CrmSequencePolicyQueryDto } from './dto/crm-sequence-policy-query.dto';
import { CrmSequenceReviewQueryDto } from './dto/crm-sequence-review-query.dto';
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
import { UpdateCrmAccountStatusDto } from './dto/update-crm-account-status.dto';
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
    private readonly gmailWatchService?: CrmGmailWatchService
  ) {}

  @Get('accounts')
  async listAccounts(@Headers('authorization') authorization = '', @Query() query: CrmAccountQueryDto) {
    return ok(await this.crmService.listAccounts(this.requireUserContext(authorization), query));
  }

  @Post('accounts/import-lead')
  async importLead(@Headers('authorization') authorization = '', @Body() dto: ImportCrmLeadDto) {
    return ok(
      await this.crmService.importAccountFromLead(
        { ...dto, sourceTaskId: null },
        this.requireUserContext(authorization)
      )
    );
  }

  @Get('accounts/:id')
  async getAccountDetail(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.getAccountDetail(id, this.requireUserContext(authorization)));
  }

  @Patch('accounts/:id/status')
  async updateAccountStatus(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmAccountStatusDto
  ) {
    return ok(await this.crmService.updateAccountStatus(id, dto, this.requireUserContext(authorization)));
  }

  @Post('accounts/:id/notes')
  async addAccountNote(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: CreateCrmAccountNoteDto
  ) {
    return ok(await this.crmService.addAccountNote(id, dto, this.requireUserContext(authorization)));
  }

  @Post('accounts/:id/archive')
  async archiveAccount(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: ArchiveCrmAccountDto
  ) {
    return ok(await this.crmService.archiveAccount(id, dto, this.requireUserContext(authorization)));
  }

  @Post('accounts/:id/restore')
  async restoreAccount(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.restoreAccount(id, this.requireUserContext(authorization)));
  }

  @Post('contacts/:id/verify-email')
  async verifyContactEmail(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.verifyContactEmail(id, this.requireUserContext(authorization)));
  }

  @Get('global-config')
  async getGlobalConfig(@Headers('authorization') authorization = '') {
    this.requireSuperUserContext(authorization);

    return ok(await this.crmService.getGlobalConfig());
  }

  @Post('global-config')
  async saveGlobalConfig(@Headers('authorization') authorization = '', @Body() dto: SaveCrmGlobalConfigDto) {
    return ok(await this.crmService.saveGlobalConfig(dto, this.requireSuperUserContext(authorization)));
  }

  @Get('organization-config')
  async getOrganizationConfig(@Headers('authorization') authorization = '') {
    return ok(await this.crmService.getOrganizationConfig(this.requireUserContext(authorization)));
  }

  @Post('organization-config')
  async saveOrganizationConfig(
    @Headers('authorization') authorization = '',
    @Body() dto: SaveCrmOrganizationConfigDto
  ) {
    return ok(await this.crmService.saveOrganizationConfig(dto, this.requireUserContext(authorization)));
  }

  @Get('blacklist-entries')
  async listBlacklistEntries(@Headers('authorization') authorization = '', @Query() query: CrmBlacklistQueryDto) {
    return ok(await this.crmService.listBlacklistEntries(this.requireUserContext(authorization), query));
  }

  @Delete('blacklist-entries/:id')
  async removeBlacklistEntry(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: RemoveCrmBlacklistEntryDto
  ) {
    return ok(await this.crmService.removeBlacklistEntry(id, dto, this.requireUserContext(authorization)));
  }

  @Post('mailboxes/mock-authorize')
  async mockAuthorizeMailbox(@Headers('authorization') authorization = '', @Body() dto: MockAuthorizeCrmMailboxDto) {
    const context = this.requireUserContext(authorization);
    this.requireMockEndpointsEnabled(context);

    return ok(await this.crmService.mockAuthorizeMailbox(dto, context));
  }

  @Post('mailboxes/gmail/oauth-url')
  createGmailOAuthUrl(@Headers('authorization') authorization = '') {
    return ok(this.crmService.createGmailOAuthAuthorizationUrl(this.requireUserContext(authorization)));
  }

  @Post('mailboxes/gmail/oauth-callback')
  async completeGmailOAuthCallback(
    @Headers('authorization') authorization = '',
    @Body() dto: CompleteCrmGmailOAuthDto
  ) {
    return ok(await this.crmService.completeGmailOAuthAuthorization(dto, this.requireUserContext(authorization)));
  }

  @Get('mailboxes')
  async listMailboxes(@Headers('authorization') authorization = '', @Query() query: CrmMailboxQueryDto) {
    return ok(await this.crmService.listMailboxes(this.requireUserContext(authorization), query));
  }

  @Patch('mailboxes/:id/pause')
  async pauseMailbox(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.pauseMailbox(id, this.requireUserContext(authorization)));
  }

  @Patch('mailboxes/:id/resume')
  async resumeMailbox(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.resumeMailbox(id, this.requireUserContext(authorization)));
  }

  @Post('mailboxes/:id/renew-watch')
  async renewMailboxWatch(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.gmailWatchService!.renewMailboxWatch(id, this.requireUserContext(authorization)));
  }

  @Post('mailboxes/:id/sync-now')
  async syncMailboxNow(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.gmailWatchService!.syncMailboxNow(id, this.requireUserContext(authorization)));
  }

  @Get('product-lines')
  async listProductLines(@Headers('authorization') authorization = '', @Query() query: CrmProductLineQueryDto) {
    return ok(await this.crmService.listProductLines(this.requireUserContext(authorization), query));
  }

  @Post('product-lines')
  async createProductLine(@Headers('authorization') authorization = '', @Body() dto: CreateCrmProductLineDto) {
    return ok(await this.crmService.createProductLine(dto, this.requireUserContext(authorization)));
  }

  @Patch('product-lines/:id')
  async updateProductLine(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmProductLineDto
  ) {
    return ok(await this.crmService.updateProductLine(id, dto, this.requireUserContext(authorization)));
  }

  @Patch('product-lines/:id/archive')
  async archiveProductLine(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.archiveProductLine(id, this.requireUserContext(authorization)));
  }

  @Get('product-lines/:id/ai-prompt-versions')
  async listProductLineAiPromptVersions(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.listProductLineAiPromptVersions(id, this.requireUserContext(authorization)));
  }

  @Post('product-lines/:id/ai-prompt-versions/:versionId/restore')
  async restoreProductLineAiPromptVersion(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(await this.crmService.restoreProductLineAiPromptVersion(id, versionId, this.requireUserContext(authorization)));
  }

  @Get('persona-profiles')
  async listPersonaProfiles(@Headers('authorization') authorization = '', @Query() query: CrmPersonaProfileQueryDto) {
    return ok(await this.crmService.listPersonaProfiles(this.requireUserContext(authorization), query));
  }

  @Post('persona-profiles')
  async createPersonaProfile(@Headers('authorization') authorization = '', @Body() dto: CreateCrmPersonaProfileDto) {
    return ok(await this.crmService.createPersonaProfile(dto, this.requireUserContext(authorization)));
  }

  @Patch('persona-profiles/:id')
  async updatePersonaProfile(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmPersonaProfileDto
  ) {
    return ok(await this.crmService.updatePersonaProfile(id, dto, this.requireUserContext(authorization)));
  }

  @Patch('persona-profiles/:id/archive')
  async archivePersonaProfile(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.archivePersonaProfile(id, this.requireUserContext(authorization)));
  }

  @Post('persona-profiles/:id/default')
  async setDefaultPersonaProfile(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.setDefaultPersonaProfile(id, this.requireUserContext(authorization)));
  }

  @Get('email-template-groups')
  async listEmailTemplateGroups(
    @Headers('authorization') authorization = '',
    @Query() query: CrmEmailTemplateQueryDto
  ) {
    return ok(await this.crmService.listEmailTemplateGroups(this.requireUserContext(authorization), query));
  }

  @Post('email-template-groups')
  async createEmailTemplateGroup(@Headers('authorization') authorization = '', @Body() dto: CreateCrmEmailTemplateDto) {
    return ok(await this.crmService.createEmailTemplateGroup(dto, this.requireUserContext(authorization)));
  }

  @Patch('email-template-groups/:id')
  async updateEmailTemplateGroup(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmEmailTemplateDto
  ) {
    return ok(await this.crmService.updateEmailTemplateGroup(id, dto, this.requireUserContext(authorization)));
  }

  @Patch('email-template-groups/:id/archive')
  async archiveEmailTemplateGroup(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.archiveEmailTemplateGroup(id, this.requireUserContext(authorization)));
  }

  @Post('email-template-groups/:id/default')
  async setDefaultEmailTemplateGroup(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.setDefaultEmailTemplateGroup(id, this.requireUserContext(authorization)));
  }

  @Get('template-defaults')
  async getTemplateDefaults(@Headers('authorization') authorization = '') {
    return ok(await this.crmService.getTemplateDefaults(this.requireUserContext(authorization)));
  }

  @Get('strategy-stats')
  async listStrategyStats(@Headers('authorization') authorization = '') {
    return ok(await this.crmService.listStrategyStats(this.requireUserContext(authorization)));
  }

  @Get('sequence-policies')
  async listSequencePolicies(@Headers('authorization') authorization = '', @Query() query: CrmSequencePolicyQueryDto) {
    return ok(await this.crmService.listSequencePolicies(this.requireUserContext(authorization), query));
  }

  @Post('sequence-policies')
  async createSequencePolicy(@Headers('authorization') authorization = '', @Body() dto: CreateCrmSequencePolicyDto) {
    return ok(await this.crmService.createSequencePolicy(dto, this.requireUserContext(authorization)));
  }

  @Patch('sequence-policies/:id')
  async updateSequencePolicy(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmSequencePolicyDto
  ) {
    return ok(await this.crmService.updateSequencePolicy(id, dto, this.requireUserContext(authorization)));
  }

  @Patch('sequence-policies/:id/archive')
  async archiveSequencePolicy(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.archiveSequencePolicy(id, this.requireUserContext(authorization)));
  }

  @Post('sequence-policies/:id/default')
  async setDefaultSequencePolicy(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.setDefaultSequencePolicy(id, this.requireUserContext(authorization)));
  }

  @Get('sequence-review-items')
  async listSequenceReviewItems(
    @Headers('authorization') authorization = '',
    @Query() query: CrmSequenceReviewQueryDto
  ) {
    return ok(await this.crmService.listSequenceReviewItems(this.requireUserContext(authorization), query));
  }

  @Post('sequence-review-items')
  async createSequenceReviewItem(
    @Headers('authorization') authorization = '',
    @Body() dto: CreateCrmSequenceReviewItemDto
  ) {
    return ok(await this.crmService.createSequenceReviewItem(dto, this.requireUserContext(authorization)));
  }

  @Get('sequence-review-items/:id')
  async getSequenceReviewItem(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.getSequenceReviewItem(id, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/batch-generate-next-draft')
  async batchGenerateNextDrafts(
    @Headers('authorization') authorization = '',
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchGenerateNextDrafts(dto, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/batch-approve-draft')
  async batchApproveMessageDrafts(
    @Headers('authorization') authorization = '',
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchApproveMessageDrafts(dto, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/batch-stop')
  async batchStopSequenceEnrollments(
    @Headers('authorization') authorization = '',
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.crmService.batchStopSequenceEnrollments(dto, this.requireUserContext(authorization)));
  }

  @Post('ai-drafts/preview')
  async previewAiDraft(@Headers('authorization') authorization = '', @Body() dto: PreviewCrmAiDraftDto) {
    return ok(await this.crmService.previewAiDraft(dto, this.requireUserContext(authorization)));
  }

  @Patch('messages/:id/draft')
  async updateMessageDraft(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmMessageDraftDto
  ) {
    return ok(await this.crmService.updateMessageDraft(id, dto, this.requireUserContext(authorization)));
  }

  @Post('messages/:id/regenerate-ai-draft')
  async regenerateMessageAiDraft(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.regenerateMessageAiDraft(id, this.requireUserContext(authorization)));
  }

  @Post('messages/:id/approve')
  async approveMessageDraft(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.approveMessageDraft(id, this.requireUserContext(authorization)));
  }

  @Get('messages/:id/draft-versions')
  async listMessageDraftVersions(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.listMessageDraftVersions(id, this.requireUserContext(authorization)));
  }

  @Post('messages/:id/draft-versions/:versionId/restore')
  async restoreMessageDraftVersion(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(await this.crmService.restoreMessageDraftVersion(id, versionId, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/:id/start-send')
  async startFirstMessageSend(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.startFirstMessageSend(id, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/:id/generate-next-draft')
  async generateNextDraft(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.generateNextDraft(id, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/:id/stop')
  async stopSequenceEnrollment(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.stopSequenceEnrollment(id, this.requireUserContext(authorization)));
  }

  @Get('inbox-threads')
  async listInboxThreads(@Headers('authorization') authorization = '', @Query() query: CrmInboxThreadQueryDto) {
    return ok(await this.crmService.listInboxThreads(this.requireUserContext(authorization), query));
  }

  @Get('inbox-threads/:id')
  async getInboxThread(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.getInboxThread(id, this.requireUserContext(authorization)));
  }

  @Patch('inbox-threads/:id/status')
  async updateInboxThreadStatus(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmInboxThreadStatusDto
  ) {
    return ok(await this.crmService.updateInboxThreadStatus(id, dto, this.requireUserContext(authorization)));
  }

  @Post('inbox-threads/:id/reply')
  async replyInboxThread(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: ReplyCrmInboxThreadDto
  ) {
    return ok(await this.crmService.replyInboxThread(id, dto, this.requireUserContext(authorization)));
  }

  @Post('inbox-threads/:id/ai-reply-polish')
  async polishInboxReplyDraft(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: PolishCrmInboxReplyDraftDto
  ) {
    return ok(await this.crmService.polishInboxReplyDraft(id, dto, this.requireUserContext(authorization)));
  }

  @Patch('inbox-threads/:id/reply-draft')
  async saveInboxReplyDraft(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: SaveCrmInboxReplyDraftDto
  ) {
    return ok(await this.crmService.saveInboxReplyDraft(id, dto, this.requireUserContext(authorization)));
  }

  @Post('messages/:id/mock-reply')
  async mockCustomerReply(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: MockCrmReplyDto
  ) {
    const context = this.requireUserContext(authorization);
    this.requireMockEndpointsEnabled(context);

    return ok(await this.crmService.mockCustomerReply(id, dto, context));
  }

  private requireMockEndpointsEnabled(context: CrmUserContext) {
    if (process.env.NODE_ENV === 'production' || process.env.CRM_ENABLE_MOCK_ENDPOINTS !== 'true') {
      throw new ForbiddenException('CRM mock 接口未启用');
    }

    if (!context.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权使用 CRM mock 接口');
    }
  }

  private requireUserContext(authorization: string): CrmUserContext {
    const user = this.requireUser(authorization);

    return {
      userId: user.userId,
      userName: user.userName,
      roles: user.roles,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole
    };
  }

  private requireSuperUserContext(authorization: string): CrmUserContext {
    const context = this.requireUserContext(authorization);

    if (!context.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权维护 CRM 全局配置');
    }

    return context;
  }

  private requireUser(authorization: string): UserInfo {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

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
