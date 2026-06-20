import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import { CRM_SUPPRESSION_REPOSITORY } from '../crm.tokens';
import type { CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { toBlacklistView } from '../shared/crm-view-mappers';
import type { CrmSuppressionRepository } from './crm-suppression.repository';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

@Injectable()
export class CrmSuppressionService {
  constructor(
    @Inject(CRM_SUPPRESSION_REPOSITORY) private readonly suppressionRepository: CrmSuppressionRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** List organization-level unsubscribe blacklist entries without exposing raw email hashes. */
  async listBlacklistEntries(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.suppressionRepository.listBlacklistEntries({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toBlacklistView)
    });
  }

  /** Remove one organization blacklist entry after recording an audit reason. */
  async removeBlacklistEntry(id: string, input: { reason?: string | null }, context: CrmUserContext) {
    const reason = normalizeNullableString(input.reason);
    if (!reason) {
      throw new BadRequestException('解除黑名单必须填写解除原因');
    }

    const entry = await this.suppressionRepository.deleteBlacklistEntry({
      id,
      organizationId: context.organizationId
    });

    if (!entry) {
      throw new NotFoundException('黑名单记录不存在');
    }

    await this.crmLogger?.record('blacklist-entry-removed', 'CRM 退订黑名单已解除', context, {
      organizationId: context.organizationId,
      blacklistEntryId: entry.id,
      maskedEmail: entry.maskedEmail,
      reason,
      sourceAccountId: entry.sourceAccountId,
      sourceContactId: entry.sourceContactId,
      sourceMessageId: entry.sourceMessageId
    });

    return {
      blacklistEntry: toBlacklistView(entry)
    };
  }
}
