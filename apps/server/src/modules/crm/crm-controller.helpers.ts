import { ForbiddenException } from '@nestjs/common';
import { assertSuper, requireSuperUserContext as requirePlatformSuperContext } from '../../shared/permission-policy';
import { requireRequestUserContext } from '../../shared/request-context';
import { AppConfigService } from '../app-config/app-config.service';
import type { CrmUserContext } from './crm.types';

/** CRM controllers common request-context and feature-gate helpers. */
export abstract class CrmControllerBase {
  protected constructor(protected readonly appConfigService?: AppConfigService) {}

  protected requireMockEndpointsEnabled(context: CrmUserContext) {
    const mockEndpointsEnabled =
      this.appConfigService?.config.crmEnableMockEndpoints ??
      (process.env.NODE_ENV !== 'production' && process.env.CRM_ENABLE_MOCK_ENDPOINTS === 'true');

    if (!mockEndpointsEnabled) {
      throw new ForbiddenException('CRM mock 接口未启用');
    }

    assertSuper(context, '无权使用 CRM mock 接口');
  }

  protected requireUserContext(context: CrmUserContext | null): CrmUserContext {
    return requireRequestUserContext(context);
  }

  protected requireSuperUserContext(context: CrmUserContext | null): CrmUserContext {
    return requirePlatformSuperContext(context, '无权维护 CRM 全局配置');
  }
}
