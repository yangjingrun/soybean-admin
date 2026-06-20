import type { CrmStore } from '../crm.types';

export type CrmDashboardRepository = Pick<CrmStore, 'listStrategyStats' | 'getWorkbenchOverview'>;
