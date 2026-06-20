import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import type { CrmEmailTemplateGroupRecord, CrmEmailTemplateStatus, CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { isPrismaUniqueConflict } from '../store/prisma-error.helpers';
import {
  CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY,
  type CrmEmailTemplateGroupRepository
} from './crm-email-template-group.repository';
import {
  defaultEmailTemplateStatus,
  normalizeEmailTemplateGroupCreateInput,
  normalizeEmailTemplateGroupUpdateInput,
  toEmailTemplateDefaultsView,
  toEmailTemplateGroupView,
  type EmailTemplateGroupCreateInput,
  type EmailTemplateGroupUpdateInput
} from './crm-email-template-group-rules';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

@Injectable()
export class CrmEmailTemplateGroupService {
  constructor(
    @Inject(CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY)
    private readonly templateGroupRepository: CrmEmailTemplateGroupRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Lists organization-level email template groups for CRM sequence drafting. */
  async listEmailTemplateGroups(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmEmailTemplateStatus;
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.templateGroupRepository.listEmailTemplateGroups({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toEmailTemplateGroupView)
    });
  }

  /** Creates one organization-level email template group with exactly five sequence steps. */
  async createEmailTemplateGroup(input: EmailTemplateGroupCreateInput, context: CrmUserContext) {
    const data = normalizeEmailTemplateGroupCreateInput(input);
    await this.assertEmailTemplateNameAvailable(context.organizationId, data.name);
    const templateGroup = await this.runEmailTemplateWrite(() =>
      this.templateGroupRepository.createEmailTemplateGroup({
        organizationId: context.organizationId,
        ...data,
        status: defaultEmailTemplateStatus,
        isDefault: false,
        createdById: context.userId,
        createdByName: context.userName
      })
    );

    await this.recordEmailTemplateLog(
      'email-template-create',
      'CRM 邮件模板新建',
      context,
      templateGroup,
      null,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Updates one organization-level email template group and replaces steps only when provided. */
  async updateEmailTemplateGroup(id: string, input: EmailTemplateGroupUpdateInput, context: CrmUserContext) {
    const currentTemplate = await this.requireScopedEmailTemplateGroup(id, context);
    const fromStatus = currentTemplate.status;
    const data = normalizeEmailTemplateGroupUpdateInput(input);

    if (data.name && data.name !== currentTemplate.name) {
      await this.assertEmailTemplateNameAvailable(context.organizationId, data.name, currentTemplate.id);
    }

    const templateGroup = await this.runEmailTemplateWrite(() =>
      this.templateGroupRepository.updateEmailTemplateGroup(currentTemplate.id, context.organizationId, data)
    );

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    await this.recordEmailTemplateLog(
      'email-template-update',
      'CRM 邮件模板更新',
      context,
      templateGroup,
      fromStatus,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Archives one organization-level email template group instead of deleting it. */
  async archiveEmailTemplateGroup(id: string, context: CrmUserContext) {
    const currentTemplate = await this.requireScopedEmailTemplateGroup(id, context);
    const fromStatus = currentTemplate.status;
    const templateGroup = await this.templateGroupRepository.updateEmailTemplateGroup(
      currentTemplate.id,
      context.organizationId,
      {
        status: 'archived',
        isDefault: false
      }
    );

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    await this.recordEmailTemplateLog(
      'email-template-archive',
      'CRM 邮件模板归档',
      context,
      templateGroup,
      fromStatus,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Marks one active organization-level email template group as the default drafting template. */
  async setDefaultEmailTemplateGroup(id: string, context: CrmUserContext) {
    const currentTemplate = await this.requireScopedEmailTemplateGroup(id, context);

    if (currentTemplate.status !== 'active') {
      throw new BadRequestException('只能将启用模板设为默认');
    }

    const templateGroup = await this.templateGroupRepository.setDefaultEmailTemplateGroup(
      currentTemplate.id,
      context.organizationId
    );

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    await this.recordEmailTemplateLog(
      'email-template-default',
      'CRM 默认邮件模板更新',
      context,
      templateGroup,
      currentTemplate.status,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Returns the read-only default template and persona rules used by first-draft generation. */
  async getTemplateDefaults(context: CrmUserContext) {
    const [defaultTemplateGroup, activePersonaProfiles] = await Promise.all([
      this.templateGroupRepository.findDefaultEmailTemplateGroup(context.organizationId),
      this.templateGroupRepository.listActivePersonaProfiles(context.organizationId)
    ]);

    if (defaultTemplateGroup) {
      return toEmailTemplateDefaultsView({
        defaultTemplateGroup,
        activePersonaProfiles
      });
    }

    const globalConfig = await this.templateGroupRepository.getGlobalConfig();

    return toEmailTemplateDefaultsView({
      defaultTemplateGroup,
      activePersonaProfiles,
      globalConfig
    });
  }

  /** Return one template group that belongs to the current organization. */
  async requireScopedEmailTemplateGroup(id: string, context: CrmUserContext) {
    const templateGroup = await this.templateGroupRepository.findEmailTemplateGroupById({
      id,
      organizationId: context.organizationId
    });

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    return templateGroup;
  }

  private async assertEmailTemplateNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingTemplate = await this.templateGroupRepository.findEmailTemplateGroupByName(organizationId, name);

    if (existingTemplate && existingTemplate.id !== ignoredId) {
      throw new BadRequestException('邮件模板名称已存在');
    }
  }

  private async runEmailTemplateWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('邮件模板名称已存在');
      }

      throw error;
    }
  }

  private recordEmailTemplateLog(
    action: string,
    message: string,
    context: CrmUserContext,
    templateGroup: CrmEmailTemplateGroupRecord,
    fromStatus: CrmEmailTemplateStatus | null,
    toStatus: CrmEmailTemplateStatus
  ) {
    return this.crmLogger?.record(action, message, context, {
      organizationId: templateGroup.organizationId,
      templateGroupId: templateGroup.id,
      name: templateGroup.name,
      status: templateGroup.status,
      isDefault: templateGroup.isDefault,
      fromStatus,
      toStatus
    });
  }
}
