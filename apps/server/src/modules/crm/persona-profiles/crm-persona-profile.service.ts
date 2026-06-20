import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { createPageResult } from '../../../shared/pagination';
import { isOrganizationAdmin as hasOrganizationAdminRole } from '../../../shared/permission-policy';
import type { CrmPersonaProfileRecord, CrmPersonaProfileStatus, CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { CRM_PERSONA_PROFILE_REPOSITORY, type CrmPersonaProfileRepository } from './crm-persona-profile.repository';
import {
  normalizePersonaProfileCreateInput,
  normalizePersonaProfileUpdateInput,
  toPersonaProfileView,
  type PersonaProfileCreateInput,
  type PersonaProfileUpdateInput
} from './crm-persona-profile-rules';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const defaultPersonaProfileStatus: CrmPersonaProfileStatus = 'active';

@Injectable()
export class CrmPersonaProfileService {
  constructor(
    @Inject(CRM_PERSONA_PROFILE_REPOSITORY)
    private readonly personaProfileRepository: CrmPersonaProfileRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Lists organization-level persona profiles used by CRM draft generation. */
  async listPersonaProfiles(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmPersonaProfileStatus;
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.personaProfileRepository.listPersonaProfiles({
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
      records: result.records.map(toPersonaProfileView)
    });
  }

  /** Creates an organization-level persona profile after checking manager permission. */
  async createPersonaProfile(input: PersonaProfileCreateInput, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const data = normalizePersonaProfileCreateInput(input);
    await this.assertPersonaProfileNameAvailable(context.organizationId, data.name);
    const personaProfile = await this.runPersonaProfileWrite(() =>
      this.personaProfileRepository.createPersonaProfile({
        organizationId: context.organizationId,
        ...data,
        status: defaultPersonaProfileStatus,
        isDefault: Boolean(input.isDefault),
        createdById: context.userId,
        createdByName: context.userName
      })
    );

    await this.recordPersonaProfileLog(
      'persona-profile-create',
      'CRM 职位/客户画像新建',
      context,
      personaProfile,
      null,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Updates one organization persona profile through scoped reads and writes. */
  async updatePersonaProfile(id: string, input: PersonaProfileUpdateInput, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const currentPersonaProfile = await this.requireScopedPersonaProfile(id, context);
    const fromStatus = currentPersonaProfile.status;
    const data = normalizePersonaProfileUpdateInput(input);
    const nextStatus = data.status ?? currentPersonaProfile.status;

    if (data.name && data.name !== currentPersonaProfile.name) {
      await this.assertPersonaProfileNameAvailable(context.organizationId, data.name, currentPersonaProfile.id);
    }

    if (data.isDefault && nextStatus !== 'active') {
      throw new BadRequestException('只能将启用画像设为默认');
    }

    if (data.status === 'archived') {
      data.isDefault = false;
    }

    const personaProfile = await this.runPersonaProfileWrite(() =>
      this.personaProfileRepository.updatePersonaProfile(currentPersonaProfile.id, context.organizationId, data)
    );

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    await this.recordPersonaProfileLog(
      'persona-profile-update',
      'CRM 职位/客户画像更新',
      context,
      personaProfile,
      fromStatus,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Archives one persona profile instead of deleting it. */
  async archivePersonaProfile(id: string, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const currentPersonaProfile = await this.requireScopedPersonaProfile(id, context);
    const personaProfile = await this.personaProfileRepository.updatePersonaProfile(
      currentPersonaProfile.id,
      context.organizationId,
      {
        status: 'archived',
        isDefault: false
      }
    );

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    await this.recordPersonaProfileLog(
      'persona-profile-archive',
      'CRM 职位/客户画像归档',
      context,
      personaProfile,
      currentPersonaProfile.status,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Marks one active persona profile as the organization default. */
  async setDefaultPersonaProfile(id: string, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const currentPersonaProfile = await this.requireScopedPersonaProfile(id, context);

    if (currentPersonaProfile.status !== 'active') {
      throw new BadRequestException('只能将启用画像设为默认');
    }

    const personaProfile = await this.personaProfileRepository.setDefaultPersonaProfile(
      currentPersonaProfile.id,
      context.organizationId
    );

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    await this.recordPersonaProfileLog(
      'persona-profile-default',
      'CRM 默认职位/客户画像更新',
      context,
      personaProfile,
      currentPersonaProfile.status,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Return one persona profile that belongs to the current organization. */
  async requireScopedPersonaProfile(id: string, context: CrmUserContext) {
    const personaProfile = await this.personaProfileRepository.findPersonaProfileById({
      id,
      organizationId: context.organizationId
    });

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    return personaProfile;
  }

  private requireOrganizationConfigManager(context: CrmUserContext) {
    if (!hasOrganizationAdminRole(context)) {
      throw new ForbiddenException('只有组织管理员可以维护 CRM 配置');
    }
  }

  private async assertPersonaProfileNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingProfile = await this.personaProfileRepository.findPersonaProfileByName(organizationId, name);

    if (existingProfile && existingProfile.id !== ignoredId) {
      throw new BadRequestException('画像名称已存在');
    }
  }

  private async runPersonaProfileWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('画像名称已存在');
      }

      throw error;
    }
  }

  private recordPersonaProfileLog(
    action: string,
    message: string,
    context: CrmUserContext,
    personaProfile: CrmPersonaProfileRecord,
    fromStatus: CrmPersonaProfileStatus | null,
    toStatus: CrmPersonaProfileStatus
  ) {
    return this.crmLogger?.record(action, message, context, {
      organizationId: personaProfile.organizationId,
      personaProfileId: personaProfile.id,
      name: personaProfile.name,
      status: personaProfile.status,
      isDefault: personaProfile.isDefault,
      fromStatus,
      toStatus
    });
  }
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
