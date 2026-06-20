import type { CrmStrategyStatsRecord, CrmWorkbenchOverviewRecord } from '../crm.types';

export interface CrmDashboardRepository {
  listStrategyStats(args: { organizationId: string; ownerUserId?: string }): Promise<CrmStrategyStatsRecord>;
  getWorkbenchOverview(args: {
    organizationId: string;
    ownerUserId: string;
    now: Date;
  }): Promise<CrmWorkbenchOverviewRecord>;
}
