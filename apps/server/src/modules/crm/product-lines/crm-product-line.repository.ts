import type { CrmStore } from '../crm.types';

export const CRM_PRODUCT_LINE_REPOSITORY = Symbol('CRM_PRODUCT_LINE_REPOSITORY');

export type CrmProductLineRepository = Pick<
  CrmStore,
  | 'listProductLines'
  | 'findProductLineByName'
  | 'findProductLineById'
  | 'createProductLine'
  | 'updateProductLine'
  | 'createProductLineAiPromptVersion'
  | 'listProductLineAiPromptVersions'
  | 'restoreProductLineAiPromptVersion'
>;
