import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
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
import { ArchiveCrmAccountDto } from './dto/archive-crm-account.dto';
import { CreateCrmAccountNoteDto } from './dto/create-crm-account-note.dto';
import { CrmAccountQueryDto } from './dto/crm-account-query.dto';
import { CrmInboxThreadQueryDto } from './dto/crm-inbox-thread-query.dto';
import { CrmMailboxQueryDto } from './dto/crm-mailbox-query.dto';
import { CrmProductLineQueryDto } from './dto/crm-product-line-query.dto';
import { CrmSequenceReviewQueryDto } from './dto/crm-sequence-review-query.dto';
import { CreateCrmSequenceReviewItemDto } from './dto/create-crm-sequence-review-item.dto';
import { CreateCrmProductLineDto } from './dto/create-crm-product-line.dto';
import { ImportCrmLeadDto } from './dto/import-crm-lead.dto';
import { MockAuthorizeCrmMailboxDto } from './dto/mock-authorize-crm-mailbox.dto';
import { MockCrmReplyDto } from './dto/mock-crm-reply.dto';
import { UpdateCrmAccountStatusDto } from './dto/update-crm-account-status.dto';
import { UpdateCrmInboxThreadStatusDto } from './dto/update-crm-inbox-thread-status.dto';
import { UpdateCrmMessageDraftDto } from './dto/update-crm-message-draft.dto';
import { UpdateCrmProductLineDto } from './dto/update-crm-product-line.dto';
import type { CrmUserContext } from './crm.types';

@Controller('crm')
export class CrmController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CrmService) private readonly crmService: CrmService
  ) {}

  @Get('accounts')
  async listAccounts(@Headers('authorization') authorization = '', @Query() query: CrmAccountQueryDto) {
    return ok(await this.crmService.listAccounts(this.requireUserContext(authorization), query));
  }

  @Post('accounts/import-lead')
  async importLead(@Headers('authorization') authorization = '', @Body() dto: ImportCrmLeadDto) {
    return ok(
      await this.crmService.importAccountFromLead({ ...dto, sourceTaskId: null }, this.requireUserContext(authorization))
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

  @Post('contacts/:id/verify-email')
  async verifyContactEmail(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.verifyContactEmail(id, this.requireUserContext(authorization)));
  }

  @Post('mailboxes/mock-authorize')
  async mockAuthorizeMailbox(
    @Headers('authorization') authorization = '',
    @Body() dto: MockAuthorizeCrmMailboxDto
  ) {
    return ok(await this.crmService.mockAuthorizeMailbox(dto, this.requireUserContext(authorization)));
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

  @Patch('messages/:id/draft')
  async updateMessageDraft(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateCrmMessageDraftDto
  ) {
    return ok(await this.crmService.updateMessageDraft(id, dto, this.requireUserContext(authorization)));
  }

  @Post('messages/:id/approve')
  async approveMessageDraft(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.approveMessageDraft(id, this.requireUserContext(authorization)));
  }

  @Post('sequence-review-items/:id/start-send')
  async startFirstMessageSend(@Headers('authorization') authorization = '', @Param('id') id: string) {
    return ok(await this.crmService.startFirstMessageSend(id, this.requireUserContext(authorization)));
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

  @Post('messages/:id/mock-reply')
  async mockCustomerReply(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: MockCrmReplyDto
  ) {
    return ok(await this.crmService.mockCustomerReply(id, dto, this.requireUserContext(authorization)));
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
