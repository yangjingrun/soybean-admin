import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmEmailTemplateGroupRepository } from './crm-email-template-group.repository';

@Injectable()
export class LegacyCrmEmailTemplateGroupRepository implements CrmEmailTemplateGroupRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

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

  listActivePersonaProfiles(
    ...args: Parameters<CrmStore['listActivePersonaProfiles']>
  ): ReturnType<CrmStore['listActivePersonaProfiles']> {
    return this.store.listActivePersonaProfiles(...args);
  }

  getGlobalConfig(...args: Parameters<CrmStore['getGlobalConfig']>): ReturnType<CrmStore['getGlobalConfig']> {
    return this.store.getGlobalConfig(...args);
  }
}
