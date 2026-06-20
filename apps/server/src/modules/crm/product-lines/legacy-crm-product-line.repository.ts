import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmProductLineRepository } from './crm-product-line.repository';

@Injectable()
export class LegacyCrmProductLineRepository implements CrmProductLineRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  listProductLines(...args: Parameters<CrmStore['listProductLines']>): ReturnType<CrmStore['listProductLines']> {
    return this.store.listProductLines(...args);
  }

  findProductLineByName(
    ...args: Parameters<CrmStore['findProductLineByName']>
  ): ReturnType<CrmStore['findProductLineByName']> {
    return this.store.findProductLineByName(...args);
  }

  findProductLineById(
    ...args: Parameters<CrmStore['findProductLineById']>
  ): ReturnType<CrmStore['findProductLineById']> {
    return this.store.findProductLineById(...args);
  }

  createProductLine(...args: Parameters<CrmStore['createProductLine']>): ReturnType<CrmStore['createProductLine']> {
    return this.store.createProductLine(...args);
  }

  updateProductLine(...args: Parameters<CrmStore['updateProductLine']>): ReturnType<CrmStore['updateProductLine']> {
    return this.store.updateProductLine(...args);
  }

  createProductLineAiPromptVersion(
    ...args: Parameters<CrmStore['createProductLineAiPromptVersion']>
  ): ReturnType<CrmStore['createProductLineAiPromptVersion']> {
    return this.store.createProductLineAiPromptVersion(...args);
  }

  listProductLineAiPromptVersions(
    ...args: Parameters<CrmStore['listProductLineAiPromptVersions']>
  ): ReturnType<CrmStore['listProductLineAiPromptVersions']> {
    return this.store.listProductLineAiPromptVersions(...args);
  }

  restoreProductLineAiPromptVersion(
    ...args: Parameters<CrmStore['restoreProductLineAiPromptVersion']>
  ): ReturnType<CrmStore['restoreProductLineAiPromptVersion']> {
    return this.store.restoreProductLineAiPromptVersion(...args);
  }
}
