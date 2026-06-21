import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import { buildPersonaMatch, type ResolvedPersonaMatch } from '../crm-persona-match';
import { CRM_SEQUENCE_REPOSITORY, CRM_SETTINGS_REPOSITORY } from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmMessageStatus,
  CrmSequenceEnrollmentStatus,
  CrmSequenceReviewTodoType,
  CrmUserContext
} from '../crm.types';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import type { CrmSequenceRepository } from './crm-sequence.repository';
import {
  CrmSequenceReviewCreationService,
  type SequenceReviewCreateInput
} from './crm-sequence-review-creation.service';
import { toSequenceReviewView } from './crm-sequence-review-view';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

@Injectable()
export class CrmSequenceService {
  constructor(
    @Inject(CRM_SETTINGS_REPOSITORY)
    private readonly settingsRepository: CrmSettingsRepository,
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly sequenceRepository: CrmSequenceRepository,
    @Optional()
    @Inject(CrmSequenceReviewCreationService)
    private readonly reviewCreationService?: CrmSequenceReviewCreationService | null
  ) {}

  /** Creates one first-email review item and deterministic draft without queueing any send job. */
  async createSequenceReviewItem(input: SequenceReviewCreateInput, context: CrmUserContext) {
    return this.requireReviewCreationService().createSequenceReviewItem(input, context);
  }

  /** Lists first-email review items within the current organization scope. */
  async listSequenceReviewItems(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmSequenceEnrollmentStatus;
      todoType?: CrmSequenceReviewTodoType;
      messageStatus?: CrmMessageStatus;
      dateScope?: 'today';
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.sequenceRepository.listSequenceReviewItems({
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.todoType ? { todoType: query.todoType } : {}),
      ...(query.messageStatus ? { messageStatus: query.messageStatus } : {}),
      ...(query.dateScope ? { dateScope: query.dateScope } : {}),
      skip: (current - 1) * size,
      take: size
    });
    const organizationProfiles = await this.settingsRepository.listActivePersonaProfiles(context.organizationId);

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(record =>
        toSequenceReviewView(record, context, buildPersonaMatch(organizationProfiles, record.account, record.contact))
      )
    });
  }

  /** Returns one review item detail with the first draft message. */
  async getSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.requireScopedSequenceReviewItem(id, context);
    const personaMatch = await this.resolvePersonaProfileMatch(item.account, item.contact, context);

    return toSequenceReviewView(item, context, personaMatch);
  }

  private requireReviewCreationService() {
    if (!this.reviewCreationService) {
      throw new Error('CRM 序列创建服务未启用');
    }

    return this.reviewCreationService;
  }

  private async requireScopedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.sequenceRepository.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return item;
  }

  private async resolvePersonaProfileMatch(
    account: Pick<CrmAccountRecord, 'customerType'>,
    contact: Pick<CrmContactRecord, 'title'>,
    context: CrmUserContext
  ): Promise<ResolvedPersonaMatch> {
    const organizationProfiles = await this.settingsRepository.listActivePersonaProfiles(context.organizationId);
    return buildPersonaMatch(organizationProfiles, account, contact);
  }
}
