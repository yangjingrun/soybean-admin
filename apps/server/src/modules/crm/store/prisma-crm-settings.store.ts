import { PrismaService } from '../../database/prisma.service';
import { PrismaCrmConfigStore } from './prisma-crm-config.store';
import { PrismaCrmEmailTemplateStore } from './prisma-crm-email-template.store';
import { PrismaCrmPersonaStore } from './prisma-crm-persona.store';
import { PrismaCrmProductLineStore } from './prisma-crm-product-line.store';
import { PrismaCrmSequencePolicyStore } from './prisma-crm-sequence-policy.store';

export class PrismaCrmSettingsStore {
  private readonly configStore: PrismaCrmConfigStore;
  private readonly productLineStore: PrismaCrmProductLineStore;
  private readonly personaStore: PrismaCrmPersonaStore;
  private readonly emailTemplateStore: PrismaCrmEmailTemplateStore;
  private readonly sequencePolicyStore: PrismaCrmSequencePolicyStore;

  constructor(private readonly prisma: PrismaService) {
    this.configStore = new PrismaCrmConfigStore(prisma);
    this.productLineStore = new PrismaCrmProductLineStore(prisma);
    this.personaStore = new PrismaCrmPersonaStore(prisma);
    this.emailTemplateStore = new PrismaCrmEmailTemplateStore(prisma);
    this.sequencePolicyStore = new PrismaCrmSequencePolicyStore(prisma);
  }

  getGlobalConfig(
    ...args: Parameters<PrismaCrmConfigStore['getGlobalConfig']>
  ): ReturnType<PrismaCrmConfigStore['getGlobalConfig']> {
    return this.configStore.getGlobalConfig(...args);
  }

  saveGlobalConfig(
    ...args: Parameters<PrismaCrmConfigStore['saveGlobalConfig']>
  ): ReturnType<PrismaCrmConfigStore['saveGlobalConfig']> {
    return this.configStore.saveGlobalConfig(...args);
  }

  getAiDraftQueueConfig(
    ...args: Parameters<PrismaCrmConfigStore['getAiDraftQueueConfig']>
  ): ReturnType<PrismaCrmConfigStore['getAiDraftQueueConfig']> {
    return this.configStore.getAiDraftQueueConfig(...args);
  }

  saveAiDraftQueueConfig(
    ...args: Parameters<PrismaCrmConfigStore['saveAiDraftQueueConfig']>
  ): ReturnType<PrismaCrmConfigStore['saveAiDraftQueueConfig']> {
    return this.configStore.saveAiDraftQueueConfig(...args);
  }

  getSendPreference(
    ...args: Parameters<PrismaCrmConfigStore['getSendPreference']>
  ): ReturnType<PrismaCrmConfigStore['getSendPreference']> {
    return this.configStore.getSendPreference(...args);
  }

  saveSendPreference(
    ...args: Parameters<PrismaCrmConfigStore['saveSendPreference']>
  ): ReturnType<PrismaCrmConfigStore['saveSendPreference']> {
    return this.configStore.saveSendPreference(...args);
  }

  getOrganizationConfig(
    ...args: Parameters<PrismaCrmConfigStore['getOrganizationConfig']>
  ): ReturnType<PrismaCrmConfigStore['getOrganizationConfig']> {
    return this.configStore.getOrganizationConfig(...args);
  }

  saveOrganizationConfig(
    ...args: Parameters<PrismaCrmConfigStore['saveOrganizationConfig']>
  ): ReturnType<PrismaCrmConfigStore['saveOrganizationConfig']> {
    return this.configStore.saveOrganizationConfig(...args);
  }

  listProductLines(
    ...args: Parameters<PrismaCrmProductLineStore['listProductLines']>
  ): ReturnType<PrismaCrmProductLineStore['listProductLines']> {
    return this.productLineStore.listProductLines(...args);
  }

  findProductLineByName(
    ...args: Parameters<PrismaCrmProductLineStore['findProductLineByName']>
  ): ReturnType<PrismaCrmProductLineStore['findProductLineByName']> {
    return this.productLineStore.findProductLineByName(...args);
  }

  findProductLineById(
    ...args: Parameters<PrismaCrmProductLineStore['findProductLineById']>
  ): ReturnType<PrismaCrmProductLineStore['findProductLineById']> {
    return this.productLineStore.findProductLineById(...args);
  }

  createProductLine(
    ...args: Parameters<PrismaCrmProductLineStore['createProductLine']>
  ): ReturnType<PrismaCrmProductLineStore['createProductLine']> {
    return this.productLineStore.createProductLine(...args);
  }

  updateProductLine(
    ...args: Parameters<PrismaCrmProductLineStore['updateProductLine']>
  ): ReturnType<PrismaCrmProductLineStore['updateProductLine']> {
    return this.productLineStore.updateProductLine(...args);
  }

  createProductLineAiPromptVersion(
    ...args: Parameters<PrismaCrmProductLineStore['createProductLineAiPromptVersion']>
  ): ReturnType<PrismaCrmProductLineStore['createProductLineAiPromptVersion']> {
    return this.productLineStore.createProductLineAiPromptVersion(...args);
  }

  listProductLineAiPromptVersions(
    ...args: Parameters<PrismaCrmProductLineStore['listProductLineAiPromptVersions']>
  ): ReturnType<PrismaCrmProductLineStore['listProductLineAiPromptVersions']> {
    return this.productLineStore.listProductLineAiPromptVersions(...args);
  }

  restoreProductLineAiPromptVersion(
    ...args: Parameters<PrismaCrmProductLineStore['restoreProductLineAiPromptVersion']>
  ): ReturnType<PrismaCrmProductLineStore['restoreProductLineAiPromptVersion']> {
    return this.productLineStore.restoreProductLineAiPromptVersion(...args);
  }

  listPersonaProfiles(
    ...args: Parameters<PrismaCrmPersonaStore['listPersonaProfiles']>
  ): ReturnType<PrismaCrmPersonaStore['listPersonaProfiles']> {
    return this.personaStore.listPersonaProfiles(...args);
  }

  listActivePersonaProfiles(
    ...args: Parameters<PrismaCrmPersonaStore['listActivePersonaProfiles']>
  ): ReturnType<PrismaCrmPersonaStore['listActivePersonaProfiles']> {
    return this.personaStore.listActivePersonaProfiles(...args);
  }

  findPersonaProfileByName(
    ...args: Parameters<PrismaCrmPersonaStore['findPersonaProfileByName']>
  ): ReturnType<PrismaCrmPersonaStore['findPersonaProfileByName']> {
    return this.personaStore.findPersonaProfileByName(...args);
  }

  findPersonaProfileById(
    ...args: Parameters<PrismaCrmPersonaStore['findPersonaProfileById']>
  ): ReturnType<PrismaCrmPersonaStore['findPersonaProfileById']> {
    return this.personaStore.findPersonaProfileById(...args);
  }

  createPersonaProfile(
    ...args: Parameters<PrismaCrmPersonaStore['createPersonaProfile']>
  ): ReturnType<PrismaCrmPersonaStore['createPersonaProfile']> {
    return this.personaStore.createPersonaProfile(...args);
  }

  updatePersonaProfile(
    ...args: Parameters<PrismaCrmPersonaStore['updatePersonaProfile']>
  ): ReturnType<PrismaCrmPersonaStore['updatePersonaProfile']> {
    return this.personaStore.updatePersonaProfile(...args);
  }

  setDefaultPersonaProfile(
    ...args: Parameters<PrismaCrmPersonaStore['setDefaultPersonaProfile']>
  ): ReturnType<PrismaCrmPersonaStore['setDefaultPersonaProfile']> {
    return this.personaStore.setDefaultPersonaProfile(...args);
  }

  listEmailTemplateGroups(
    ...args: Parameters<PrismaCrmEmailTemplateStore['listEmailTemplateGroups']>
  ): ReturnType<PrismaCrmEmailTemplateStore['listEmailTemplateGroups']> {
    return this.emailTemplateStore.listEmailTemplateGroups(...args);
  }

  findEmailTemplateGroupByName(
    ...args: Parameters<PrismaCrmEmailTemplateStore['findEmailTemplateGroupByName']>
  ): ReturnType<PrismaCrmEmailTemplateStore['findEmailTemplateGroupByName']> {
    return this.emailTemplateStore.findEmailTemplateGroupByName(...args);
  }

  findEmailTemplateGroupById(
    ...args: Parameters<PrismaCrmEmailTemplateStore['findEmailTemplateGroupById']>
  ): ReturnType<PrismaCrmEmailTemplateStore['findEmailTemplateGroupById']> {
    return this.emailTemplateStore.findEmailTemplateGroupById(...args);
  }

  findDefaultEmailTemplateGroup(
    ...args: Parameters<PrismaCrmEmailTemplateStore['findDefaultEmailTemplateGroup']>
  ): ReturnType<PrismaCrmEmailTemplateStore['findDefaultEmailTemplateGroup']> {
    return this.emailTemplateStore.findDefaultEmailTemplateGroup(...args);
  }

  createEmailTemplateGroup(
    ...args: Parameters<PrismaCrmEmailTemplateStore['createEmailTemplateGroup']>
  ): ReturnType<PrismaCrmEmailTemplateStore['createEmailTemplateGroup']> {
    return this.emailTemplateStore.createEmailTemplateGroup(...args);
  }

  updateEmailTemplateGroup(
    ...args: Parameters<PrismaCrmEmailTemplateStore['updateEmailTemplateGroup']>
  ): ReturnType<PrismaCrmEmailTemplateStore['updateEmailTemplateGroup']> {
    return this.emailTemplateStore.updateEmailTemplateGroup(...args);
  }

  setDefaultEmailTemplateGroup(
    ...args: Parameters<PrismaCrmEmailTemplateStore['setDefaultEmailTemplateGroup']>
  ): ReturnType<PrismaCrmEmailTemplateStore['setDefaultEmailTemplateGroup']> {
    return this.emailTemplateStore.setDefaultEmailTemplateGroup(...args);
  }

  listSequencePolicies(
    ...args: Parameters<PrismaCrmSequencePolicyStore['listSequencePolicies']>
  ): ReturnType<PrismaCrmSequencePolicyStore['listSequencePolicies']> {
    return this.sequencePolicyStore.listSequencePolicies(...args);
  }

  findSequencePolicyByName(
    ...args: Parameters<PrismaCrmSequencePolicyStore['findSequencePolicyByName']>
  ): ReturnType<PrismaCrmSequencePolicyStore['findSequencePolicyByName']> {
    return this.sequencePolicyStore.findSequencePolicyByName(...args);
  }

  findSequencePolicyById(
    ...args: Parameters<PrismaCrmSequencePolicyStore['findSequencePolicyById']>
  ): ReturnType<PrismaCrmSequencePolicyStore['findSequencePolicyById']> {
    return this.sequencePolicyStore.findSequencePolicyById(...args);
  }

  findDefaultSequencePolicy(
    ...args: Parameters<PrismaCrmSequencePolicyStore['findDefaultSequencePolicy']>
  ): ReturnType<PrismaCrmSequencePolicyStore['findDefaultSequencePolicy']> {
    return this.sequencePolicyStore.findDefaultSequencePolicy(...args);
  }

  createSequencePolicy(
    ...args: Parameters<PrismaCrmSequencePolicyStore['createSequencePolicy']>
  ): ReturnType<PrismaCrmSequencePolicyStore['createSequencePolicy']> {
    return this.sequencePolicyStore.createSequencePolicy(...args);
  }

  updateSequencePolicy(
    ...args: Parameters<PrismaCrmSequencePolicyStore['updateSequencePolicy']>
  ): ReturnType<PrismaCrmSequencePolicyStore['updateSequencePolicy']> {
    return this.sequencePolicyStore.updateSequencePolicy(...args);
  }

  setDefaultSequencePolicy(
    ...args: Parameters<PrismaCrmSequencePolicyStore['setDefaultSequencePolicy']>
  ): ReturnType<PrismaCrmSequencePolicyStore['setDefaultSequencePolicy']> {
    return this.sequencePolicyStore.setDefaultSequencePolicy(...args);
  }
}
