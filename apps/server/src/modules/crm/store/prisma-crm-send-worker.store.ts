import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmSendWorkerRepository } from '../crm-send-worker.repository';
import { PrismaCrmEmailTemplateGroupStore } from './prisma-crm-email-template-group.store';
import { PrismaCrmMailboxStore } from './prisma-crm-mailbox.store';
import { PrismaCrmSequenceStore } from './prisma-crm-sequence.store';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';

@Injectable()
export class PrismaCrmSendWorkerStore implements CrmSendWorkerRepository {
  private readonly sequenceStore: PrismaCrmSequenceStore;
  private readonly mailboxStore: PrismaCrmMailboxStore;
  private readonly settingsStore: PrismaCrmSettingsStore;
  private readonly emailTemplateGroupStore: PrismaCrmEmailTemplateGroupStore;

  constructor(prisma: PrismaService) {
    this.sequenceStore = new PrismaCrmSequenceStore(prisma);
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
    this.settingsStore = new PrismaCrmSettingsStore(prisma);
    this.emailTemplateGroupStore = new PrismaCrmEmailTemplateGroupStore(prisma);
  }

  startFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceStore['startFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceStore['startFirstMessageSend']> {
    return this.sequenceStore.startFirstMessageSend(...args);
  }

  claimFirstMessageSendDelivery(
    ...args: Parameters<PrismaCrmSequenceStore['claimFirstMessageSendDelivery']>
  ): ReturnType<PrismaCrmSequenceStore['claimFirstMessageSendDelivery']> {
    return this.sequenceStore.claimFirstMessageSendDelivery(...args);
  }

  completeFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceStore['completeFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceStore['completeFirstMessageSend']> {
    return this.sequenceStore.completeFirstMessageSend(...args);
  }

  failFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceStore['failFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceStore['failFirstMessageSend']> {
    return this.sequenceStore.failFirstMessageSend(...args);
  }

  markMailboxAuthorizationExpired(
    ...args: Parameters<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']>
  ): ReturnType<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']> {
    return this.mailboxStore.markMailboxAuthorizationExpired(...args);
  }

  getGlobalConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getGlobalConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getGlobalConfig']> {
    return this.settingsStore.getGlobalConfig(...args);
  }

  findDefaultEmailTemplateGroup(
    ...args: Parameters<PrismaCrmEmailTemplateGroupStore['findDefaultEmailTemplateGroup']>
  ): ReturnType<PrismaCrmEmailTemplateGroupStore['findDefaultEmailTemplateGroup']> {
    return this.emailTemplateGroupStore.findDefaultEmailTemplateGroup(...args);
  }
}
