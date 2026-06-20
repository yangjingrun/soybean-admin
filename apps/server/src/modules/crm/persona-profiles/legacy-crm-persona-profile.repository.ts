import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmPersonaProfileRepository } from './crm-persona-profile.repository';

@Injectable()
export class LegacyCrmPersonaProfileRepository implements CrmPersonaProfileRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  listPersonaProfiles(
    ...args: Parameters<CrmStore['listPersonaProfiles']>
  ): ReturnType<CrmStore['listPersonaProfiles']> {
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

  createPersonaProfile(
    ...args: Parameters<CrmStore['createPersonaProfile']>
  ): ReturnType<CrmStore['createPersonaProfile']> {
    return this.store.createPersonaProfile(...args);
  }

  updatePersonaProfile(
    ...args: Parameters<CrmStore['updatePersonaProfile']>
  ): ReturnType<CrmStore['updatePersonaProfile']> {
    return this.store.updatePersonaProfile(...args);
  }

  setDefaultPersonaProfile(
    ...args: Parameters<CrmStore['setDefaultPersonaProfile']>
  ): ReturnType<CrmStore['setDefaultPersonaProfile']> {
    return this.store.setDefaultPersonaProfile(...args);
  }
}
