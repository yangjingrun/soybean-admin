import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PrismaCrmConfigStore } from './prisma-crm-config.store';
import { PrismaCrmEmailTemplateStore } from './prisma-crm-email-template.store';
import { PrismaCrmPersonaStore } from './prisma-crm-persona.store';
import type { CrmEmailTemplateGroupRepository } from '../template-groups/crm-email-template-group.repository';

@Injectable()
export class PrismaCrmEmailTemplateGroupStore implements CrmEmailTemplateGroupRepository {
  private readonly configStore: PrismaCrmConfigStore;
  private readonly emailTemplateStore: PrismaCrmEmailTemplateStore;
  private readonly personaStore: PrismaCrmPersonaStore;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.configStore = new PrismaCrmConfigStore(prisma);
    this.emailTemplateStore = new PrismaCrmEmailTemplateStore(prisma);
    this.personaStore = new PrismaCrmPersonaStore(prisma);
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

  listActivePersonaProfiles(
    ...args: Parameters<PrismaCrmPersonaStore['listActivePersonaProfiles']>
  ): ReturnType<PrismaCrmPersonaStore['listActivePersonaProfiles']> {
    return this.personaStore.listActivePersonaProfiles(...args);
  }

  getGlobalConfig(
    ...args: Parameters<PrismaCrmConfigStore['getGlobalConfig']>
  ): ReturnType<PrismaCrmConfigStore['getGlobalConfig']> {
    return this.configStore.getGlobalConfig(...args);
  }
}
