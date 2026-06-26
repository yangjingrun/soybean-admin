import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { CurrentContext } from '../../auth/auth.decorators';
import { CrmAccountService } from '../accounts/crm-account.service';
import { CrmControllerBase } from '../crm-controller.helpers';
import type { CrmUserContext } from '../crm.types';
import { ArchiveCrmAccountDto } from '../dto/archive-crm-account.dto';
import { CreateCrmContactDto } from '../dto/create-crm-contact.dto';
import { CreateCrmAccountNoteDto } from '../dto/create-crm-account-note.dto';
import { CrmAccountQueryDto } from '../dto/crm-account-query.dto';
import { ImportCrmLeadDto } from '../dto/import-crm-lead.dto';
import { RefreshCrmAccountEnrichmentDto } from '../dto/refresh-crm-account-enrichment.dto';
import { UpdateCrmContactDto } from '../dto/update-crm-contact.dto';
import { UpdateCrmAccountDto } from '../dto/update-crm-account.dto';
import { UpdateCrmAccountStatusDto } from '../dto/update-crm-account-status.dto';

/** Handles CRM accounts, lead imports, account notes, archive/restore, and contact email verify endpoints. */
@Controller('crm')
export class CrmAccountController extends CrmControllerBase {
  constructor(@Inject(CrmAccountService) private readonly accountService: CrmAccountService) {
    super();
  }

  @Get('accounts')
  async listAccounts(@CurrentContext() context: CrmUserContext | null = null, @Query() query: CrmAccountQueryDto) {
    return ok(await this.accountService.listAccounts(this.requireUserContext(context), query));
  }

  @Post('accounts/import-lead')
  async importLead(@CurrentContext() context: CrmUserContext | null = null, @Body() dto: ImportCrmLeadDto) {
    return ok(
      await this.accountService.importAccountFromLead({ ...dto, sourceTaskId: null }, this.requireUserContext(context))
    );
  }

  @Get('accounts/:id')
  async getAccountDetail(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.accountService.getAccountDetail(id, this.requireUserContext(context)));
  }

  @Patch('accounts/:id')
  async updateAccount(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmAccountDto
  ) {
    return ok(await this.accountService.updateAccount(id, dto, this.requireUserContext(context)));
  }

  @Patch('accounts/:id/status')
  async updateAccountStatus(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmAccountStatusDto
  ) {
    return ok(await this.accountService.updateAccountStatus(id, dto, this.requireUserContext(context)));
  }

  @Post('accounts/:id/notes')
  async addAccountNote(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: CreateCrmAccountNoteDto
  ) {
    return ok(await this.accountService.addAccountNote(id, dto, this.requireUserContext(context)));
  }

  @Post('accounts/:id/contacts')
  async createContact(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: CreateCrmContactDto
  ) {
    return ok(await this.accountService.createContact(id, dto, this.requireUserContext(context)));
  }

  @Patch('contacts/:id')
  async updateContact(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateCrmContactDto
  ) {
    return ok(await this.accountService.updateContact(id, dto, this.requireUserContext(context)));
  }

  @Post('contacts/:id/delete')
  async deleteContact(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.accountService.deleteContact(id, this.requireUserContext(context)));
  }

  @Post('accounts/:id/archive')
  async archiveAccount(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: ArchiveCrmAccountDto
  ) {
    return ok(await this.accountService.archiveAccount(id, dto, this.requireUserContext(context)));
  }

  @Post('accounts/:id/restore')
  async restoreAccount(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.accountService.restoreAccount(id, this.requireUserContext(context)));
  }

  @Post('accounts/:id/enrichment/refresh')
  async refreshAccountEnrichment(
    @CurrentContext() context: CrmUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: RefreshCrmAccountEnrichmentDto
  ) {
    return ok(await this.accountService.refreshAccountEnrichment(id, dto, this.requireUserContext(context)));
  }

  @Post('contacts/:id/verify-email')
  async verifyContactEmail(@CurrentContext() context: CrmUserContext | null = null, @Param('id') id: string) {
    return ok(await this.accountService.verifyContactEmail(id, this.requireUserContext(context)));
  }
}
