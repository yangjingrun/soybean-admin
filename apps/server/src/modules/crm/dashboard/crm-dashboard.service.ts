import { Inject, Injectable } from '@nestjs/common';
import { CRM_DASHBOARD_REPOSITORY } from '../crm.tokens';
import type { CrmUserContext } from '../crm.types';
import { createCrmReadScope } from '../shared/crm-scope';
import type { CrmDashboardRepository } from './crm-dashboard.repository';

@Injectable()
export class CrmDashboardService {
  constructor(@Inject(CRM_DASHBOARD_REPOSITORY) private readonly dashboardRepository: CrmDashboardRepository) {}

  /** Reads local CRM funnel stats grouped by template, policy, persona and product line. */
  listStrategyStats(context: CrmUserContext) {
    return this.dashboardRepository.listStrategyStats({
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });
  }

  /** Reads the current user's action-first CRM workbench overview. */
  getWorkbenchOverview(context: CrmUserContext, now = new Date()) {
    return this.dashboardRepository.getWorkbenchOverview({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      now
    });
  }
}

function toOwnerScope(context: CrmUserContext) {
  const scope = createCrmReadScope(context);
  return scope.ownerUserId ? { ownerUserId: scope.ownerUserId } : {};
}
