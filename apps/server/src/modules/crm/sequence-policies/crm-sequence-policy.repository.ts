import type { CrmStore } from '../crm.types';

export const CRM_SEQUENCE_POLICY_REPOSITORY = Symbol('CRM_SEQUENCE_POLICY_REPOSITORY');

export type CrmSequencePolicyRepository = Pick<
  CrmStore,
  | 'listSequencePolicies'
  | 'findSequencePolicyByName'
  | 'findSequencePolicyById'
  | 'findDefaultSequencePolicy'
  | 'createSequencePolicy'
  | 'updateSequencePolicy'
  | 'setDefaultSequencePolicy'
>;
