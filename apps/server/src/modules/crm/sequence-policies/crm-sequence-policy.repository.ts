import type {
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyRecord,
  CrmSequencePolicyUpdateInput
} from '../crm.types';

export const CRM_SEQUENCE_POLICY_REPOSITORY = Symbol('CRM_SEQUENCE_POLICY_REPOSITORY');

export interface CrmSequencePolicyRepository {
  listSequencePolicies(input: CrmSequencePolicyListInput): Promise<{
    records: CrmSequencePolicyRecord[];
    total: number;
  }>;
  findSequencePolicyByName(organizationId: string, name: string): Promise<CrmSequencePolicyRecord | null>;
  findSequencePolicyById(args: { id: string; organizationId: string }): Promise<CrmSequencePolicyRecord | null>;
  findDefaultSequencePolicy(organizationId: string): Promise<CrmSequencePolicyRecord | null>;
  createSequencePolicy(input: CrmSequencePolicyCreateInput): Promise<CrmSequencePolicyRecord>;
  updateSequencePolicy(
    id: string,
    organizationId: string,
    input: CrmSequencePolicyUpdateInput
  ): Promise<CrmSequencePolicyRecord | null>;
  setDefaultSequencePolicy(id: string, organizationId: string): Promise<CrmSequencePolicyRecord | null>;
}
