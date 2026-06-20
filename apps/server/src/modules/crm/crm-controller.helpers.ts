import { ForbiddenException } from '@nestjs/common';
import { assertSuper, requireSuperUserContext as requirePlatformSuperContext } from '../../shared/permission-policy';
import { requireRequestUserContext } from '../../shared/request-context';
import { AppConfigService } from '../app-config/app-config.service';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmService } from './crm.service';
import type { CrmUserContext } from './crm.types';

/** CRM controllers common request-context and feature-gate helpers. */
export abstract class CrmControllerBase {
  protected constructor(
    protected readonly crmService: CrmService,
    protected readonly gmailWatchService?: CrmGmailWatchService,
    protected readonly appConfigService?: AppConfigService
  ) {}

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

type ControllerCtor = { prototype: object };

/** Copies prototype methods so the legacy CrmController keeps old direct-call tests working. */
export function applyControllerMixins(derivedCtor: ControllerCtor, constructors: ControllerCtor[]) {
  for (const baseCtor of constructors) {
    for (const name of Object.getOwnPropertyNames(baseCtor.prototype)) {
      if (name === 'constructor') {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(baseCtor.prototype, name);

      if (descriptor) {
        Object.defineProperty(derivedCtor.prototype, name, descriptor);
      }
    }
  }
}
