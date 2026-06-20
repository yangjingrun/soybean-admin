import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { AppConfigService } from '../../app-config/app-config.service';
import { CurrentContext } from '../../auth/auth.decorators';
import { CrmAiDraftTaskService } from '../ai-draft-task/crm-ai-draft-task.service';
import { CrmControllerBase } from '../crm-controller.helpers';
import type { CrmUserContext } from '../crm.types';
import { BatchCrmSequenceReviewItemsDto } from '../dto/batch-crm-sequence-review-items.dto';
import { CreateCrmAiDraftTaskDto } from '../dto/create-crm-ai-draft-task.dto';
import { CreateCrmSequenceReviewItemDto } from '../dto/create-crm-sequence-review-item.dto';
import { CrmAiDraftTaskQueryDto } from '../dto/crm-ai-draft-task-query.dto';
import { CrmSequenceReviewQueryDto } from '../dto/crm-sequence-review-query.dto';
import { PreviewCrmAiDraftDto } from '../dto/preview-crm-ai-draft.dto';
import { UpdateCrmMessageDraftDto } from '../dto/update-crm-message-draft.dto';
import { CrmBatchDraftApprovalService } from '../sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from '../sequence/crm-batch-sequence-stop.service';
import { CrmDraftPreviewService } from '../sequence/crm-draft-preview.service';
import { CrmDraftService } from '../sequence/crm-draft.service';
import { CrmMessageDraftApprovalRouterService } from '../sequence/crm-message-draft-approval-router.service';
import { CrmNextDraftService } from '../sequence/crm-next-draft.service';
import { CrmSequenceControlService } from '../sequence/crm-sequence-control.service';
import { CrmSequenceService } from '../sequence/crm-sequence.service';

/** Handles CRM sequence review items, message drafts, AI draft preview/regeneration, and AI draft tasks. */
@Controller('crm')
export class CrmSequenceController extends CrmControllerBase {
  constructor(
    @Inject(CrmSequenceService)
    private readonly sequenceService: CrmSequenceService,
    @Inject(CrmNextDraftService)
    private readonly nextDraftService: CrmNextDraftService,
    @Inject(CrmAiDraftTaskService)
    private readonly aiDraftTaskService: CrmAiDraftTaskService,
    @Inject(CrmBatchDraftApprovalService)
    private readonly batchDraftApprovalService: CrmBatchDraftApprovalService,
    @Inject(CrmBatchSequenceStopService)
    private readonly batchSequenceStopService: CrmBatchSequenceStopService,
    @Inject(CrmDraftPreviewService)
    private readonly draftPreviewService: CrmDraftPreviewService,
    @Inject(CrmDraftService)
    private readonly draftService: CrmDraftService,
    @Inject(CrmMessageDraftApprovalRouterService)
    private readonly messageDraftApprovalRouterService: CrmMessageDraftApprovalRouterService,
    @Inject(CrmSequenceControlService)
    private readonly sequenceControlService: CrmSequenceControlService,
    @Inject(AppConfigService)
    appConfigService: AppConfigService
  ) {
    super(appConfigService);
  }

  @Get('sequence-review-items')
  async listSequenceReviewItems(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmSequenceReviewQueryDto
  ) {
    return ok(await this.sequenceService.listSequenceReviewItems(this.requireUserContext(context), query));
  }

  @Post('sequence-review-items')
  async createSequenceReviewItem(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmSequenceReviewItemDto
  ) {
    return ok(await this.sequenceService.createSequenceReviewItem(dto, this.requireUserContext(context)));
  }

  @Get('sequence-review-items/:id')
  async getSequenceReviewItem(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.sequenceService.getSequenceReviewItem(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/batch-generate-next-draft')
  async batchGenerateNextDrafts(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.nextDraftService.batchGenerateNextDrafts(dto, this.requireUserContext(context)));
  }

  @Post('ai-draft-tasks')
  async createAiDraftTask(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: CreateCrmAiDraftTaskDto
  ) {
    return ok(await this.aiDraftTaskService.createAiDraftTask(dto, this.requireUserContext(context)));
  }

  @Get('ai-draft-tasks/current')
  async getCurrentAiDraftTask(@CurrentContext() context: CrmUserContext | null = null) {
    return ok(await this.aiDraftTaskService.getCurrentAiDraftTask(this.requireUserContext(context)));
  }

  @Get('ai-draft-tasks')
  async listAiDraftTasks(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmAiDraftTaskQueryDto
  ) {
    return ok(await this.aiDraftTaskService.listAiDraftTasks(this.requireUserContext(context), query));
  }

  @Get('ai-draft-tasks/:id')
  async getAiDraftTaskDetail(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.aiDraftTaskService.getAiDraftTaskDetail(id, this.requireUserContext(context)));
  }

  @Post('ai-draft-tasks/:id/retry-failed')
  async retryFailedAiDraftTask(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.aiDraftTaskService.retryFailedAiDraftTask(id, this.requireUserContext(context)));
  }

  @Post('ai-draft-tasks/:id/cancel')
  async cancelAiDraftTask(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.aiDraftTaskService.cancelAiDraftTask(id, this.requireUserContext(context)));
  }

  @Patch('ai-draft-tasks/:id/read')
  async markAiDraftTaskRead(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.aiDraftTaskService.markAiDraftTaskRead(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/batch-approve-draft')
  async batchApproveMessageDrafts(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.batchDraftApprovalService.batchApproveMessageDrafts(dto, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/batch-stop')
  async batchStopSequenceEnrollments(
    @CurrentContext() context: CrmUserContext | null = null,
    @Body() dto: BatchCrmSequenceReviewItemsDto
  ) {
    return ok(await this.batchSequenceStopService.batchStopSequenceEnrollments(dto, this.requireUserContext(context)));
  }

  @Post('ai-drafts/preview')
  async previewAiDraft(@CurrentContext() context: CrmUserContext | null = null, @Body() dto: PreviewCrmAiDraftDto) {
    return ok(await this.draftPreviewService.previewAiDraft(dto, this.requireUserContext(context)));
  }

  @Patch('messages/:id/draft')
  async updateMessageDraft(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmMessageDraftDto
  ) {
    return ok(await this.draftService.updateMessageDraft(id, dto, this.requireUserContext(context)));
  }

  @Post('messages/:id/regenerate-ai-draft')
  async regenerateMessageAiDraft(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.draftService.regenerateMessageAiDraft(id, this.requireUserContext(context)));
  }

  @Post('messages/:id/approve')
  async approveMessageDraft(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.messageDraftApprovalRouterService.approveMessageDraft(id, this.requireUserContext(context)));
  }

  @Get('messages/:id/draft-versions')
  async listMessageDraftVersions(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.draftService.listMessageDraftVersions(id, this.requireUserContext(context)));
  }

  @Post('messages/:id/draft-versions/:versionId/restore')
  async restoreMessageDraftVersion(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ) {
    return ok(await this.draftService.restoreMessageDraftVersion(id, versionId, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/:id/start-send')
  async startFirstMessageSend(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.sequenceControlService.startFirstMessageSend(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/:id/generate-next-draft')
  async generateNextDraft(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.nextDraftService.generateNextDraft(id, this.requireUserContext(context)));
  }

  @Post('sequence-review-items/:id/stop')
  async stopSequenceEnrollment(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.sequenceControlService.stopSequenceEnrollment(id, this.requireUserContext(context)));
  }
}
