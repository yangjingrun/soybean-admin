import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { CurrentContext, SuperOnly } from '../../auth/auth.decorators';
import { CrmAiDraftTaskService } from '../ai-draft-task/crm-ai-draft-task.service';
import { CrmControllerBase } from '../crm-controller.helpers';
import { CrmDashboardService } from '../dashboard/crm-dashboard.service';
import type { CrmUserContext } from '../crm.types';
import { CreateCrmEmailTemplateDto } from '../dto/create-crm-email-template.dto';
import { CreateCrmPersonaProfileDto } from '../dto/create-crm-persona-profile.dto';
import { CreateCrmProductLineDto } from '../dto/create-crm-product-line.dto';
import { CreateCrmSequencePolicyDto } from '../dto/create-crm-sequence-policy.dto';
import { CrmBlacklistQueryDto } from '../dto/crm-blacklist-query.dto';
import { CrmEmailTemplateQueryDto } from '../dto/crm-email-template-query.dto';
import { CrmPersonaProfileQueryDto } from '../dto/crm-persona-profile-query.dto';
import { CrmProductLineQueryDto } from '../dto/crm-product-line-query.dto';
import { CrmSequencePolicyQueryDto } from '../dto/crm-sequence-policy-query.dto';
import { RemoveCrmBlacklistEntryDto } from '../dto/remove-crm-blacklist-entry.dto';
import { SaveCrmGlobalConfigDto } from '../dto/save-crm-global-config.dto';
import { SaveCrmOrganizationConfigDto } from '../dto/save-crm-organization-config.dto';
import { SaveCrmSendPreferenceDto } from '../dto/save-crm-send-preference.dto';
import { UpdateCrmAiDraftQueueConfigDto } from '../dto/update-crm-ai-draft-queue-config.dto';
import { UpdateCrmEmailTemplateDto } from '../dto/update-crm-email-template.dto';
import { UpdateCrmPersonaProfileDto } from '../dto/update-crm-persona-profile.dto';
import { UpdateCrmProductLineDto } from '../dto/update-crm-product-line.dto';
import { UpdateCrmSequencePolicyDto } from '../dto/update-crm-sequence-policy.dto';
import { CrmPersonaProfileService } from '../persona-profiles/crm-persona-profile.service';
import { CrmProductLineService } from '../product-lines/crm-product-line.service';
import { CrmSendQueueReconcileService } from '../sequence/crm-send-queue-reconcile.service';
import { CrmSequencePolicyService } from '../sequence-policies/crm-sequence-policy.service';
import { CrmSettingsService } from '../settings/crm-settings.service';
import { CrmSuppressionService } from '../suppression/crm-suppression.service';
import { CrmEmailTemplateGroupService } from '../template-groups/crm-email-template-group.service';

/** Handles CRM settings, suppression, template defaults, strategy workbench, and queue configuration endpoints. */
@Controller('crm')
export class CrmSettingsController extends CrmControllerBase {
  constructor(
    @Inject(CrmSettingsService) private readonly settingsService: CrmSettingsService,
    @Inject(CrmAiDraftTaskService) private readonly aiDraftTaskService: CrmAiDraftTaskService,
    @Inject(CrmSendQueueReconcileService) private readonly sendQueueReconcileService: CrmSendQueueReconcileService,
    @Inject(CrmSuppressionService) private readonly suppressionService: CrmSuppressionService,
    @Inject(CrmProductLineService) private readonly productLineService: CrmProductLineService,
    @Inject(CrmPersonaProfileService) private readonly personaProfileService: CrmPersonaProfileService,
    @Inject(CrmEmailTemplateGroupService) private readonly emailTemplateGroupService: CrmEmailTemplateGroupService,
    @Inject(CrmSequencePolicyService) private readonly sequencePolicyService: CrmSequencePolicyService,
    @Inject(CrmDashboardService) private readonly dashboardService: CrmDashboardService
  ) {
    super();
  }

  @Get('global-config')
  @SuperOnly('无权维护 CRM 全局配置')
  async getGlobalConfig(@CurrentContext() context: CrmUserContext | null = null) {
    this.requireSuperUserContext(context);

    return ok(await this.settingsService.getGlobalConfig());
  }

  @Post('global-config')
  @SuperOnly('无权维护 CRM 全局配置')
  async saveGlobalConfig(@CurrentContext() context: CrmUserContext | null = null, @Body() dto: SaveCrmGlobalConfigDto) {
    return ok(await this.settingsService.saveGlobalConfig(dto, this.requireSuperUserContext(context)));
  }

  @Get('ai-draft-queue-config')
  @SuperOnly('无权维护 CRM 全局配置')
  async getAiDraftQueueConfig(@CurrentContext() context: CrmUserContext | null = null) {
    this.requireSuperUserContext(context);

    return ok(await this.aiDraftTaskService.getAiDraftQueueConfig());
  }

  @Patch('ai-draft-queue-config')
  @SuperOnly('无权维护 CRM 全局配置')
  async saveAiDraftQueueConfig(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: UpdateCrmAiDraftQueueConfigDto
  ) {
    return ok(await this.aiDraftTaskService.saveAiDraftQueueConfig(dto, this.requireSuperUserContext(context)));
  }

  @Post('operations/send-queue/reconcile')
  @SuperOnly('无权维护 CRM 全局配置')
  async reconcileSendQueue(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.sendQueueReconcileService.reconcileSendQueue({}, this.requireSuperUserContext(context)));
  }

  @Get('send-preference')
  async getSendPreference(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.settingsService.getSendPreference(this.requireUserContext(context)));
  }

  @Post('send-preference')
  async saveSendPreference(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: SaveCrmSendPreferenceDto
  ) {
    return ok(await this.settingsService.saveSendPreference(dto, this.requireUserContext(context)));
  }

  @Get('organization-config')
  async getOrganizationConfig(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.settingsService.getOrganizationConfig(this.requireUserContext(context)));
  }

  @Post('organization-config')
  async saveOrganizationConfig(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: SaveCrmOrganizationConfigDto
  ) {
    return ok(await this.settingsService.saveOrganizationConfig(dto, this.requireUserContext(context)));
  }

  @Get('blacklist-entries')
  async listBlacklistEntries(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmBlacklistQueryDto
  ) {
    return ok(await this.suppressionService.listBlacklistEntries(this.requireUserContext(context), query));
  }

  @Delete('blacklist-entries/:id')
  async removeBlacklistEntry(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: RemoveCrmBlacklistEntryDto
  ) {
    return ok(await this.suppressionService.removeBlacklistEntry(id, dto, this.requireUserContext(context)));
  }

  @Get('product-lines')
  async listProductLines(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmProductLineQueryDto
  ) {
    return ok(await this.productLineService.listProductLines(this.requireUserContext(context), query));
  }

  @Post('product-lines')
  async createProductLine(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmProductLineDto
  ) {
    return ok(await this.productLineService.createProductLine(dto, this.requireUserContext(context)));
  }

  @Patch('product-lines/:id')
  async updateProductLine(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmProductLineDto
  ) {
    return ok(await this.productLineService.updateProductLine(id, dto, this.requireUserContext(context)));
  }

  @Patch('product-lines/:id/archive')
  async archiveProductLine(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.productLineService.archiveProductLine(id, this.requireUserContext(context)));
  }

  @Get('product-lines/:id/ai-prompt-versions')
  async listProductLineAiPromptVersions(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string
  ) {
    return ok(await this.productLineService.listProductLineAiPromptVersions(id, this.requireUserContext(context)));
  }

  @Post('product-lines/:id/ai-prompt-versions/:versionId/restore')
  async restoreProductLineAiPromptVersion(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(
      await this.productLineService.restoreProductLineAiPromptVersion(id, versionId, this.requireUserContext(context))
    );
  }

  @Get('persona-profiles')
  async listPersonaProfiles(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmPersonaProfileQueryDto
  ) {
    return ok(await this.personaProfileService.listPersonaProfiles(this.requireUserContext(context), query));
  }

  @Post('persona-profiles')
  async createPersonaProfile(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmPersonaProfileDto
  ) {
    return ok(await this.personaProfileService.createPersonaProfile(dto, this.requireUserContext(context)));
  }

  @Patch('persona-profiles/:id')
  async updatePersonaProfile(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmPersonaProfileDto
  ) {
    return ok(await this.personaProfileService.updatePersonaProfile(id, dto, this.requireUserContext(context)));
  }

  @Patch('persona-profiles/:id/archive')
  async archivePersonaProfile(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.personaProfileService.archivePersonaProfile(id, this.requireUserContext(context)));
  }

  @Post('persona-profiles/:id/default')
  async setDefaultPersonaProfile(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.personaProfileService.setDefaultPersonaProfile(id, this.requireUserContext(context)));
  }

  @Get('email-template-groups')
  async listEmailTemplateGroups(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmEmailTemplateQueryDto
  ) {
    return ok(await this.emailTemplateGroupService.listEmailTemplateGroups(this.requireUserContext(context), query));
  }

  @Post('email-template-groups')
  async createEmailTemplateGroup(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmEmailTemplateDto
  ) {
    return ok(await this.emailTemplateGroupService.createEmailTemplateGroup(dto, this.requireUserContext(context)));
  }

  @Patch('email-template-groups/:id')
  async updateEmailTemplateGroup(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmEmailTemplateDto
  ) {
    return ok(await this.emailTemplateGroupService.updateEmailTemplateGroup(id, dto, this.requireUserContext(context)));
  }

  @Patch('email-template-groups/:id/archive')
  async archiveEmailTemplateGroup(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.emailTemplateGroupService.archiveEmailTemplateGroup(id, this.requireUserContext(context)));
  }

  @Post('email-template-groups/:id/default')
  async setDefaultEmailTemplateGroup(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.emailTemplateGroupService.setDefaultEmailTemplateGroup(id, this.requireUserContext(context)));
  }

  @Get('template-defaults')
  async getTemplateDefaults(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.emailTemplateGroupService.getTemplateDefaults(this.requireUserContext(context)));
  }

  @Get('strategy-stats')
  async listStrategyStats(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.dashboardService.listStrategyStats(this.requireUserContext(context)));
  }

  @Get('workbench/overview')
  async getWorkbenchOverview(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.dashboardService.getWorkbenchOverview(this.requireUserContext(context)));
  }

  @Get('sequence-policies')
  async listSequencePolicies(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmSequencePolicyQueryDto
  ) {
    return ok(await this.sequencePolicyService.listSequencePolicies(this.requireUserContext(context), query));
  }

  @Post('sequence-policies')
  async createSequencePolicy(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmSequencePolicyDto
  ) {
    return ok(await this.sequencePolicyService.createSequencePolicy(dto, this.requireUserContext(context)));
  }

  @Patch('sequence-policies/:id')
  async updateSequencePolicy(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmSequencePolicyDto
  ) {
    return ok(await this.sequencePolicyService.updateSequencePolicy(id, dto, this.requireUserContext(context)));
  }

  @Patch('sequence-policies/:id/archive')
  async archiveSequencePolicy(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.sequencePolicyService.archiveSequencePolicy(id, this.requireUserContext(context)));
  }

  @Post('sequence-policies/:id/default')
  async setDefaultSequencePolicy(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.sequencePolicyService.setDefaultSequencePolicy(id, this.requireUserContext(context)));
  }
}
