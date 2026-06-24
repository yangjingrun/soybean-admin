import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmBatchSequenceStopRepository } from '../sequence/crm-batch-sequence-stop.repository';
import type { CrmSequenceControlRepository } from '../sequence/crm-sequence-control.repository';
import { PrismaCrmSendScheduleStore } from './prisma-crm-send-schedule.store';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';
import { PrismaCrmSequenceSendStateStore } from './prisma-crm-sequence-send-state.store';
import { PrismaCrmSuppressionStore } from './prisma-crm-suppression.store';

@Injectable()
export class PrismaCrmSequenceControlStore implements CrmSequenceControlRepository, CrmBatchSequenceStopRepository {
  private readonly reviewStore: PrismaCrmSequenceReviewStore;
  private readonly sendScheduleStore: PrismaCrmSendScheduleStore;
  private readonly sendStateStore: PrismaCrmSequenceSendStateStore;
  private readonly suppressionStore: PrismaCrmSuppressionStore;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.reviewStore = new PrismaCrmSequenceReviewStore(prisma);
    this.sendScheduleStore = new PrismaCrmSendScheduleStore(prisma);
    this.sendStateStore = new PrismaCrmSequenceSendStateStore(prisma);
    this.suppressionStore = new PrismaCrmSuppressionStore(prisma);
  }

  getSequenceReviewItem(
    ...args: Parameters<PrismaCrmSequenceReviewStore['getSequenceReviewItem']>
  ): ReturnType<PrismaCrmSequenceReviewStore['getSequenceReviewItem']> {
    return this.reviewStore.getSequenceReviewItem(...args);
  }

  findBlacklistEntry(
    ...args: Parameters<PrismaCrmSuppressionStore['findBlacklistEntry']>
  ): ReturnType<PrismaCrmSuppressionStore['findBlacklistEntry']> {
    return this.suppressionStore.findBlacklistEntry(...args);
  }

  listMailboxSendScheduleTimes(
    ...args: Parameters<PrismaCrmSendScheduleStore['listMailboxSendScheduleTimes']>
  ): ReturnType<PrismaCrmSendScheduleStore['listMailboxSendScheduleTimes']> {
    return this.sendScheduleStore.listMailboxSendScheduleTimes(...args);
  }

  startFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['startFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['startFirstMessageSend']> {
    return this.sendStateStore.startFirstMessageSend(...args);
  }

  stopSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['stopSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['stopSequenceEnrollment']> {
    return this.sendStateStore.stopSequenceEnrollment(...args);
  }

  returnFirstMessageToEdit(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['returnFirstMessageToEdit']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['returnFirstMessageToEdit']> {
    return this.sendStateStore.returnFirstMessageToEdit(...args);
  }

  resumeSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['resumeSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['resumeSequenceEnrollment']> {
    return this.sendStateStore.resumeSequenceEnrollment(...args);
  }

  retryFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['retryFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['retryFirstMessageSend']> {
    return this.sendStateStore.retryFirstMessageSend(...args);
  }
}
