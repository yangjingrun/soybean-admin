import type {
  CrmProductLineAiPromptVersionCreateInput,
  CrmProductLineAiPromptVersionRecord,
  CrmProductLineAiPromptVersionRestoreInput,
  CrmProductLineAiPromptVersionRestoreRecord,
  CrmProductLineCreateInput,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmProductLineUpdateInput
} from '../crm.types';

export const CRM_PRODUCT_LINE_REPOSITORY = Symbol('CRM_PRODUCT_LINE_REPOSITORY');

export interface CrmProductLineRepository {
  listProductLines(args: {
    organizationId: string;
    keyword?: string;
    status?: CrmProductLineStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmProductLineRecord[]; total: number }>;
  findProductLineByName(organizationId: string, name: string): Promise<CrmProductLineRecord | null>;
  findProductLineById(args: { id: string; organizationId: string }): Promise<CrmProductLineRecord | null>;
  createProductLine(input: CrmProductLineCreateInput): Promise<CrmProductLineRecord>;
  updateProductLine(
    id: string,
    organizationId: string,
    input: CrmProductLineUpdateInput
  ): Promise<CrmProductLineRecord | null>;
  createProductLineAiPromptVersion(
    input: CrmProductLineAiPromptVersionCreateInput
  ): Promise<CrmProductLineAiPromptVersionRecord>;
  listProductLineAiPromptVersions(args: {
    organizationId: string;
    productLineId: string;
  }): Promise<CrmProductLineAiPromptVersionRecord[]>;
  restoreProductLineAiPromptVersion(
    input: CrmProductLineAiPromptVersionRestoreInput
  ): Promise<CrmProductLineAiPromptVersionRestoreRecord | null>;
}
