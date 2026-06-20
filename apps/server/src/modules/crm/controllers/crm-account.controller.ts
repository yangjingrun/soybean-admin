import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { CurrentContext } from '../../auth/auth.decorators';
import { CrmControllerBase } from '../crm-controller.helpers';
import { CrmService } from '../crm.service';
import type { CrmUserContext } from '../crm.types';
import { ArchiveCrmAccountDto } from '../dto/archive-crm-account.dto';
import { CreateCrmAccountNoteDto } from '../dto/create-crm-account-note.dto';
import { CrmAccountQueryDto } from '../dto/crm-account-query.dto';
import { ImportCrmLeadDto } from '../dto/import-crm-lead.dto';
import { UpdateCrmAccountStatusDto } from '../dto/update-crm-account-status.dto';

/** Handles CRM accounts, lead imports, account notes, archive/restore, and contact email verify endpoints. */
@Controller('crm')
export class CrmAccountController extends CrmControllerBase {
  constructor(@Inject(CrmService) crmService: CrmService) {
    super(crmService);
  }

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
}
