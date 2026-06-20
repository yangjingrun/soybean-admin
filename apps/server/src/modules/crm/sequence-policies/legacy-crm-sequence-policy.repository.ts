import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmSequencePolicyRepository } from './crm-sequence-policy.repository';

@Injectable()
export class LegacyCrmSequencePolicyRepository implements CrmSequencePolicyRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  listSequencePolicies(
    ...args: Parameters<CrmStore['listSequencePolicies']>
  ): ReturnType<CrmStore['listSequencePolicies']> {
    return this.store.listSequencePolicies(...args);
  }

  findSequencePolicyByName(
    ...args: Parameters<CrmStore['findSequencePolicyByName']>
  ): ReturnType<CrmStore['findSequencePolicyByName']> {
    return this.store.findSequencePolicyByName(...args);
  }

  findSequencePolicyById(
    ...args: Parameters<CrmStore['findSequencePolicyById']>
  ): ReturnType<CrmStore['findSequencePolicyById']> {
    return this.store.findSequencePolicyById(...args);
  }

  findDefaultSequencePolicy(
    ...args: Parameters<CrmStore['findDefaultSequencePolicy']>
  ): ReturnType<CrmStore['findDefaultSequencePolicy']> {
    return this.store.findDefaultSequencePolicy(...args);
  }

  createSequencePolicy(
    ...args: Parameters<CrmStore['createSequencePolicy']>
  ): ReturnType<CrmStore['createSequencePolicy']> {
    return this.store.createSequencePolicy(...args);
  }

  updateSequencePolicy(
    ...args: Parameters<CrmStore['updateSequencePolicy']>
  ): ReturnType<CrmStore['updateSequencePolicy']> {
    return this.store.updateSequencePolicy(...args);
  }

  setDefaultSequencePolicy(
    ...args: Parameters<CrmStore['setDefaultSequencePolicy']>
  ): ReturnType<CrmStore['setDefaultSequencePolicy']> {
    return this.store.setDefaultSequencePolicy(...args);
  }
}
