import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmSuppressionRepository } from './crm-suppression.repository';

@Injectable()
export class LegacyCrmSuppressionRepository implements CrmSuppressionRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  findBlacklistEntry(...args: Parameters<CrmStore['findBlacklistEntry']>): ReturnType<CrmStore['findBlacklistEntry']> {
    return this.store.findBlacklistEntry(...args);
  }

  listBlacklistEntriesByEmailHashes(
    ...args: Parameters<CrmStore['listBlacklistEntriesByEmailHashes']>
  ): ReturnType<CrmStore['listBlacklistEntriesByEmailHashes']> {
    return this.store.listBlacklistEntriesByEmailHashes(...args);
  }

  upsertBlacklistEntry(...args: Parameters<CrmStore['upsertBlacklistEntry']>): ReturnType<CrmStore['upsertBlacklistEntry']> {
    return this.store.upsertBlacklistEntry(...args);
  }

  listBlacklistEntries(...args: Parameters<CrmStore['listBlacklistEntries']>): ReturnType<CrmStore['listBlacklistEntries']> {
    return this.store.listBlacklistEntries(...args);
  }

  deleteBlacklistEntry(...args: Parameters<CrmStore['deleteBlacklistEntry']>): ReturnType<CrmStore['deleteBlacklistEntry']> {
    return this.store.deleteBlacklistEntry(...args);
  }
}
