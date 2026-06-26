import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmSendSchedulerRepository } from '../crm-send-scheduler.repository';
import { PrismaCrmMessageDraftStore } from './prisma-crm-message-draft.store';
import { PrismaCrmSendScheduleStore } from './prisma-crm-send-schedule.store';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';

@Injectable()
export class PrismaCrmSendSchedulerStore implements CrmSendSchedulerRepository {
  private readonly settingsStore: PrismaCrmSettingsStore;
  private readonly sendScheduleStore: PrismaCrmSendScheduleStore;
  private readonly messageDraftStore: PrismaCrmMessageDraftStore;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.settingsStore = new PrismaCrmSettingsStore(prisma);
    this.sendScheduleStore = new PrismaCrmSendScheduleStore(prisma);
    this.messageDraftStore = new PrismaCrmMessageDraftStore(prisma);
  }

  getGlobalConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getGlobalConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getGlobalConfig']> {
    return this.settingsStore.getGlobalConfig(...args);
  }

  listDueSendCandidates(
    ...args: Parameters<PrismaCrmSendScheduleStore['listDueSendCandidates']>
  ): ReturnType<PrismaCrmSendScheduleStore['listDueSendCandidates']> {
    return this.sendScheduleStore.listDueSendCandidates(...args);
  }

  listOwnerSendStates(
    ...args: Parameters<PrismaCrmSendScheduleStore['listOwnerSendStates']>
  ): ReturnType<PrismaCrmSendScheduleStore['listOwnerSendStates']> {
    return this.sendScheduleStore.listOwnerSendStates(...args);
  }

  listMailboxSendStates(
    ...args: Parameters<PrismaCrmSendScheduleStore['listMailboxSendStates']>
  ): ReturnType<PrismaCrmSendScheduleStore['listMailboxSendStates']> {
    return this.sendScheduleStore.listMailboxSendStates(...args);
  }

  updateMessage(
    ...args: Parameters<PrismaCrmMessageDraftStore['updateMessage']>
  ): ReturnType<PrismaCrmMessageDraftStore['updateMessage']> {
    return this.messageDraftStore.updateMessage(...args);
  }
}
