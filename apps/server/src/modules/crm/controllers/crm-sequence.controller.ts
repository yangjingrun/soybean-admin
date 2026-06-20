import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { CurrentContext } from '../../auth/auth.decorators';
import { CrmControllerBase } from '../crm-controller.helpers';
import { CrmService } from '../crm.service';
import type { CrmUserContext } from '../crm.types';
import { BatchCrmSequenceReviewItemsDto } from '../dto/batch-crm-sequence-review-items.dto';
import { CreateCrmAiDraftTaskDto } from '../dto/create-crm-ai-draft-task.dto';
import { CreateCrmSequenceReviewItemDto } from '../dto/create-crm-sequence-review-item.dto';
import { CrmAiDraftTaskQueryDto } from '../dto/crm-ai-draft-task-query.dto';
import { CrmSequenceReviewQueryDto } from '../dto/crm-sequence-review-query.dto';
import { PreviewCrmAiDraftDto } from '../dto/preview-crm-ai-draft.dto';
import { UpdateCrmMessageDraftDto } from '../dto/update-crm-message-draft.dto';

/** Handles CRM sequence review items, message drafts, AI draft preview/regeneration, and AI draft tasks. */
@Controller('crm')
export class CrmSequenceController extends CrmControllerBase {
  constructor(@Inject(CrmService) crmService: CrmService) {
    super(crmService);
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
}
