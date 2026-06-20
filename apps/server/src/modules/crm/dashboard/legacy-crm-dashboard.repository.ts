import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmDashboardRepository } from './crm-dashboard.repository';

@Injectable()
export class LegacyCrmDashboardRepository implements CrmDashboardRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  listStrategyStats(...args: Parameters<CrmStore['listStrategyStats']>): ReturnType<CrmStore['listStrategyStats']> {
    return this.store.listStrategyStats(...args);
  }

  getWorkbenchOverview(
    ...args: Parameters<CrmStore['getWorkbenchOverview']>
  ): ReturnType<CrmStore['getWorkbenchOverview']> {
    return this.store.getWorkbenchOverview(...args);
  }
}
