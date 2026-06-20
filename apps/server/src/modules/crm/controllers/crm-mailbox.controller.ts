import { Body, Controller, Get, Inject, Optional, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { AppConfigService } from '../../app-config/app-config.service';
import { CurrentContext, SuperOnly } from '../../auth/auth.decorators';
import { CrmControllerBase } from '../crm-controller.helpers';
import { CrmGmailWatchService } from '../crm-gmail-watch.service';
import { CrmService } from '../crm.service';
import type { CrmUserContext } from '../crm.types';
import { CompleteCrmGmailOAuthDto } from '../dto/complete-crm-gmail-oauth.dto';
import { CrmMailboxQueryDto } from '../dto/crm-mailbox-query.dto';
import { MockAuthorizeCrmMailboxDto } from '../dto/mock-authorize-crm-mailbox.dto';

/** Handles CRM mailboxes, Gmail OAuth flow, watch renewal, sync, and mailbox mock authorization. */
@Controller('crm')
export class CrmMailboxController extends CrmControllerBase {
  constructor(
    @Inject(CrmService) crmService: CrmService,
    @Optional()
    @Inject(CrmGmailWatchService)
    gmailWatchService?: CrmGmailWatchService,
    @Optional()
    @Inject(AppConfigService)
    appConfigService?: AppConfigService
  ) {
    super(crmService, gmailWatchService, appConfigService);
  }

  @Post('mailboxes/mock-authorize')
  @SuperOnly('无权使用 CRM mock 接口')
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
}
