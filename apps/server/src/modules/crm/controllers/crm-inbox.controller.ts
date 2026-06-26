import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { AppConfigService } from '../../app-config/app-config.service';
import { CurrentContext, SuperOnly } from '../../auth/auth.decorators';
import { CrmControllerBase } from '../crm-controller.helpers';
import type { CrmUserContext } from '../crm.types';
import { CrmInboxThreadQueryDto } from '../dto/crm-inbox-thread-query.dto';
import { MockCrmReplyDto } from '../dto/mock-crm-reply.dto';
import { PolishCrmInboxReplyDraftDto } from '../dto/polish-crm-inbox-reply-draft.dto';
import { ReplyCrmInboxThreadDto } from '../dto/reply-crm-inbox-thread.dto';
import { SaveCrmInboxReplyDraftDto } from '../dto/save-crm-inbox-reply-draft.dto';
import { UpdateCrmInboxThreadStatusDto } from '../dto/update-crm-inbox-thread-status.dto';
import { CrmInboxService } from '../inbox/crm-inbox.service';

/** Handles CRM inbox threads, inbound messages, reply drafting, unsubscribe confirmation, and mock replies. */
@Controller('crm')
export class CrmInboxController extends CrmControllerBase {
  constructor(
    @Inject(CrmInboxService) private readonly inboxService: CrmInboxService,
    @Inject(AppConfigService)
    appConfigService: AppConfigService
  ) {
    super(appConfigService);
  }

  @Get('inbox-threads')
  async listInboxThreads(
    @CurrentContext() context: CrmUserContext | null = null,
    @Query() query: CrmInboxThreadQueryDto
  ) {
    return ok(await this.inboxService.listInboxThreads(this.requireUserContext(context), query));
  }

  @Get('inbox-threads/:id')
  async getInboxThread(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.inboxService.getInboxThread(id, this.requireUserContext(context)));
  }

  @Patch('inbox-threads/:id/status')
  async updateInboxThreadStatus(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmInboxThreadStatusDto
  ) {
    return ok(await this.inboxService.updateInboxThreadStatus(id, dto, this.requireUserContext(context)));
  }

  @Post('inbox-threads/:id/reply')
  async replyInboxThread(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: ReplyCrmInboxThreadDto
  ) {
    return ok(await this.inboxService.replyInboxThread(id, dto, this.requireUserContext(context)));
  }

  @Post('inbox-threads/:id/ai-reply-polish')
  async polishInboxReplyDraft(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: PolishCrmInboxReplyDraftDto
  ) {
    return ok(await this.inboxService.polishInboxReplyDraft(id, dto, this.requireUserContext(context)));
  }

  @Patch('inbox-threads/:id/reply-draft')
  async saveInboxReplyDraft(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: SaveCrmInboxReplyDraftDto
  ) {
    return ok(await this.inboxService.saveInboxReplyDraft(id, dto, this.requireUserContext(context)));
  }

  @Post('inbox-messages/:id/confirm-unsubscribe')
  async confirmInboxMessageUnsubscribe(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string
  ) {
    return ok(await this.inboxService.confirmInboxMessageUnsubscribe(id, this.requireUserContext(context)));
  }

  @Post('messages/:id/mock-reply')
  @SuperOnly('无权使用 CRM mock 接口')
  async mockCustomerReply(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: MockCrmReplyDto
  ) {
    const requestContext = this.requireUserContext(context);
    this.requireMockEndpointsEnabled(requestContext);

    return ok(await this.inboxService.mockCustomerReply(id, dto, requestContext));
  }
}
