import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmSettingsRepository } from './crm-settings.repository';

@Injectable()
export class LegacyCrmSettingsRepository implements CrmSettingsRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  getGlobalConfig(...args: Parameters<CrmStore['getGlobalConfig']>): ReturnType<CrmStore['getGlobalConfig']> {
    return this.store.getGlobalConfig(...args);
  }

  saveGlobalConfig(...args: Parameters<CrmStore['saveGlobalConfig']>): ReturnType<CrmStore['saveGlobalConfig']> {
    return this.store.saveGlobalConfig(...args);
  }

  getSendPreference(...args: Parameters<CrmStore['getSendPreference']>): ReturnType<CrmStore['getSendPreference']> {
    return this.store.getSendPreference(...args);
  }

  saveSendPreference(...args: Parameters<CrmStore['saveSendPreference']>): ReturnType<CrmStore['saveSendPreference']> {
    return this.store.saveSendPreference(...args);
  }

  getOrganizationConfig(
    ...args: Parameters<CrmStore['getOrganizationConfig']>
  ): ReturnType<CrmStore['getOrganizationConfig']> {
    return this.store.getOrganizationConfig(...args);
  }

  saveOrganizationConfig(
    ...args: Parameters<CrmStore['saveOrganizationConfig']>
  ): ReturnType<CrmStore['saveOrganizationConfig']> {
    return this.store.saveOrganizationConfig(...args);
  }

  listProductLines(...args: Parameters<CrmStore['listProductLines']>): ReturnType<CrmStore['listProductLines']> {
    return this.store.listProductLines(...args);
  }

  findProductLineByName(
    ...args: Parameters<CrmStore['findProductLineByName']>
  ): ReturnType<CrmStore['findProductLineByName']> {
    return this.store.findProductLineByName(...args);
  }

  findProductLineById(...args: Parameters<CrmStore['findProductLineById']>): ReturnType<CrmStore['findProductLineById']> {
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

  listPersonaProfiles(...args: Parameters<CrmStore['listPersonaProfiles']>): ReturnType<CrmStore['listPersonaProfiles']> {
    return this.store.listPersonaProfiles(...args);
  }

  listActivePersonaProfiles(
    ...args: Parameters<CrmStore['listActivePersonaProfiles']>
  ): ReturnType<CrmStore['listActivePersonaProfiles']> {
    return this.store.listActivePersonaProfiles(...args);
  }

  findPersonaProfileByName(
    ...args: Parameters<CrmStore['findPersonaProfileByName']>
  ): ReturnType<CrmStore['findPersonaProfileByName']> {
    return this.store.findPersonaProfileByName(...args);
  }

  findPersonaProfileById(
    ...args: Parameters<CrmStore['findPersonaProfileById']>
  ): ReturnType<CrmStore['findPersonaProfileById']> {
    return this.store.findPersonaProfileById(...args);
  }

  createPersonaProfile(...args: Parameters<CrmStore['createPersonaProfile']>): ReturnType<CrmStore['createPersonaProfile']> {
    return this.store.createPersonaProfile(...args);
  }

  updatePersonaProfile(...args: Parameters<CrmStore['updatePersonaProfile']>): ReturnType<CrmStore['updatePersonaProfile']> {
    return this.store.updatePersonaProfile(...args);
  }

  setDefaultPersonaProfile(
    ...args: Parameters<CrmStore['setDefaultPersonaProfile']>
  ): ReturnType<CrmStore['setDefaultPersonaProfile']> {
    return this.store.setDefaultPersonaProfile(...args);
  }

  listEmailTemplateGroups(
    ...args: Parameters<CrmStore['listEmailTemplateGroups']>
  ): ReturnType<CrmStore['listEmailTemplateGroups']> {
    return this.store.listEmailTemplateGroups(...args);
  }

  findEmailTemplateGroupByName(
    ...args: Parameters<CrmStore['findEmailTemplateGroupByName']>
  ): ReturnType<CrmStore['findEmailTemplateGroupByName']> {
    return this.store.findEmailTemplateGroupByName(...args);
  }

  findEmailTemplateGroupById(
    ...args: Parameters<CrmStore['findEmailTemplateGroupById']>
  ): ReturnType<CrmStore['findEmailTemplateGroupById']> {
    return this.store.findEmailTemplateGroupById(...args);
  }

  findDefaultEmailTemplateGroup(
    ...args: Parameters<CrmStore['findDefaultEmailTemplateGroup']>
  ): ReturnType<CrmStore['findDefaultEmailTemplateGroup']> {
    return this.store.findDefaultEmailTemplateGroup(...args);
  }

  createEmailTemplateGroup(
    ...args: Parameters<CrmStore['createEmailTemplateGroup']>
  ): ReturnType<CrmStore['createEmailTemplateGroup']> {
    return this.store.createEmailTemplateGroup(...args);
  }

  updateEmailTemplateGroup(
    ...args: Parameters<CrmStore['updateEmailTemplateGroup']>
  ): ReturnType<CrmStore['updateEmailTemplateGroup']> {
    return this.store.updateEmailTemplateGroup(...args);
  }

  setDefaultEmailTemplateGroup(
    ...args: Parameters<CrmStore['setDefaultEmailTemplateGroup']>
  ): ReturnType<CrmStore['setDefaultEmailTemplateGroup']> {
    return this.store.setDefaultEmailTemplateGroup(...args);
  }

  listSequencePolicies(...args: Parameters<CrmStore['listSequencePolicies']>): ReturnType<CrmStore['listSequencePolicies']> {
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

  createSequencePolicy(...args: Parameters<CrmStore['createSequencePolicy']>): ReturnType<CrmStore['createSequencePolicy']> {
    return this.store.createSequencePolicy(...args);
  }

  updateSequencePolicy(...args: Parameters<CrmStore['updateSequencePolicy']>): ReturnType<CrmStore['updateSequencePolicy']> {
    return this.store.updateSequencePolicy(...args);
  }

  setDefaultSequencePolicy(
    ...args: Parameters<CrmStore['setDefaultSequencePolicy']>
  ): ReturnType<CrmStore['setDefaultSequencePolicy']> {
    return this.store.setDefaultSequencePolicy(...args);
  }

  getAiDraftQueueConfig(
    ...args: Parameters<CrmStore['getAiDraftQueueConfig']>
  ): ReturnType<CrmStore['getAiDraftQueueConfig']> {
    return this.store.getAiDraftQueueConfig(...args);
  }

  saveAiDraftQueueConfig(
    ...args: Parameters<CrmStore['saveAiDraftQueueConfig']>
  ): ReturnType<CrmStore['saveAiDraftQueueConfig']> {
    return this.store.saveAiDraftQueueConfig(...args);
  }
}
