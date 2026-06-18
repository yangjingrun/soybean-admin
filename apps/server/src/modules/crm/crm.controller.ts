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
import { ImportCrmLeadDto } from './dto/import-crm-lead.dto';
import { UpdateCrmAccountStatusDto } from './dto/update-crm-account-status.dto';
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
