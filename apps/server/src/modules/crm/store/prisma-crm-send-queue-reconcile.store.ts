import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmSendQueueReconcileRepository } from '../sequence/crm-send-queue-reconcile.repository';
import { PrismaCrmAccountStore } from './prisma-crm-account.store';
import { PrismaCrmMessageDraftStore } from './prisma-crm-message-draft.store';
import { PrismaCrmSendScheduleStore } from './prisma-crm-send-schedule.store';

@Injectable()
export class PrismaCrmSendQueueReconcileStore implements CrmSendQueueReconcileRepository {
  private readonly accountStore: PrismaCrmAccountStore;
  private readonly messageDraftStore: PrismaCrmMessageDraftStore;
  private readonly sendScheduleStore: PrismaCrmSendScheduleStore;

  constructor(prisma: PrismaService) {
    this.accountStore = new PrismaCrmAccountStore(prisma);
    this.messageDraftStore = new PrismaCrmMessageDraftStore(prisma);
    this.sendScheduleStore = new PrismaCrmSendScheduleStore(prisma);
  }

  listStaleQueuedMessages(
    ...args: Parameters<PrismaCrmSendScheduleStore['listStaleQueuedMessages']>
  ): ReturnType<PrismaCrmSendScheduleStore['listStaleQueuedMessages']> {
    return this.sendScheduleStore.listStaleQueuedMessages(...args);
  }

  updateMessage(
    ...args: Parameters<PrismaCrmMessageDraftStore['updateMessage']>
  ): ReturnType<PrismaCrmMessageDraftStore['updateMessage']> {
    return this.messageDraftStore.updateMessage(...args);
  }

  createTimelineEvent(
    ...args: Parameters<PrismaCrmAccountStore['createTimelineEvent']>
  ): ReturnType<PrismaCrmAccountStore['createTimelineEvent']> {
    return this.accountStore.createTimelineEvent(...args);
  }
}
