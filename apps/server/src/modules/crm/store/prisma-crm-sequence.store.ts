import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmSequenceRepository } from '../sequence/crm-sequence.repository';
import { PrismaCrmMessageDraftStore } from './prisma-crm-message-draft.store';
import { PrismaCrmSequenceReviewStore } from './prisma-crm-sequence-review.store';
import { PrismaCrmSequenceSendStateStore } from './prisma-crm-sequence-send-state.store';

@Injectable()
export class PrismaCrmSequenceStore implements CrmSequenceRepository {
  private readonly reviewStore: PrismaCrmSequenceReviewStore;
  private readonly messageDraftStore: PrismaCrmMessageDraftStore;
  private readonly sendStateStore: PrismaCrmSequenceSendStateStore;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.reviewStore = new PrismaCrmSequenceReviewStore(prisma);
    this.messageDraftStore = new PrismaCrmMessageDraftStore(prisma);
    this.sendStateStore = new PrismaCrmSequenceSendStateStore(prisma);
  }

  findActiveEnrollmentByContact(
    ...args: Parameters<PrismaCrmSequenceReviewStore['findActiveEnrollmentByContact']>
  ): ReturnType<PrismaCrmSequenceReviewStore['findActiveEnrollmentByContact']> {
    return this.reviewStore.findActiveEnrollmentByContact(...args);
  }

  findActiveEnrollmentByAccount(
    ...args: Parameters<PrismaCrmSequenceReviewStore['findActiveEnrollmentByAccount']>
  ): ReturnType<PrismaCrmSequenceReviewStore['findActiveEnrollmentByAccount']> {
    return this.reviewStore.findActiveEnrollmentByAccount(...args);
  }

  createSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceReviewStore['createSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceReviewStore['createSequenceEnrollment']> {
    return this.reviewStore.createSequenceEnrollment(...args);
  }

  createSequenceDraftBundle(
    ...args: Parameters<PrismaCrmSequenceReviewStore['createSequenceDraftBundle']>
  ): ReturnType<PrismaCrmSequenceReviewStore['createSequenceDraftBundle']> {
    return this.reviewStore.createSequenceDraftBundle(...args);
  }

  createFollowUpDraftBundle(
    ...args: Parameters<PrismaCrmSequenceReviewStore['createFollowUpDraftBundle']>
  ): ReturnType<PrismaCrmSequenceReviewStore['createFollowUpDraftBundle']> {
    return this.reviewStore.createFollowUpDraftBundle(...args);
  }

  listSequenceReviewItems(
    ...args: Parameters<PrismaCrmSequenceReviewStore['listSequenceReviewItems']>
  ): ReturnType<PrismaCrmSequenceReviewStore['listSequenceReviewItems']> {
    return this.reviewStore.listSequenceReviewItems(...args);
  }

  getSequenceReviewItem(
    ...args: Parameters<PrismaCrmSequenceReviewStore['getSequenceReviewItem']>
  ): ReturnType<PrismaCrmSequenceReviewStore['getSequenceReviewItem']> {
    return this.reviewStore.getSequenceReviewItem(...args);
  }

  listSequenceReviewItemsByIds(
    ...args: Parameters<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']>
  ): ReturnType<PrismaCrmSequenceReviewStore['listSequenceReviewItemsByIds']> {
    return this.reviewStore.listSequenceReviewItemsByIds(...args);
  }

  updateSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceReviewStore['updateSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceReviewStore['updateSequenceEnrollment']> {
    return this.reviewStore.updateSequenceEnrollment(...args);
  }

  createMessage(
    ...args: Parameters<PrismaCrmMessageDraftStore['createMessage']>
  ): ReturnType<PrismaCrmMessageDraftStore['createMessage']> {
    return this.messageDraftStore.createMessage(...args);
  }

  findMessageById(
    ...args: Parameters<PrismaCrmMessageDraftStore['findMessageById']>
  ): ReturnType<PrismaCrmMessageDraftStore['findMessageById']> {
    return this.messageDraftStore.findMessageById(...args);
  }

  findSentMessageByProviderId(
    ...args: Parameters<PrismaCrmMessageDraftStore['findSentMessageByProviderId']>
  ): ReturnType<PrismaCrmMessageDraftStore['findSentMessageByProviderId']> {
    return this.messageDraftStore.findSentMessageByProviderId(...args);
  }

  findSentMessageByProviderThreadId(
    ...args: Parameters<PrismaCrmMessageDraftStore['findSentMessageByProviderThreadId']>
  ): ReturnType<PrismaCrmMessageDraftStore['findSentMessageByProviderThreadId']> {
    return this.messageDraftStore.findSentMessageByProviderThreadId(...args);
  }

  updateMessage(
    ...args: Parameters<PrismaCrmMessageDraftStore['updateMessage']>
  ): ReturnType<PrismaCrmMessageDraftStore['updateMessage']> {
    return this.messageDraftStore.updateMessage(...args);
  }

  createMessageDraftVersion(
    ...args: Parameters<PrismaCrmMessageDraftStore['createMessageDraftVersion']>
  ): ReturnType<PrismaCrmMessageDraftStore['createMessageDraftVersion']> {
    return this.messageDraftStore.createMessageDraftVersion(...args);
  }

  listMessageDraftVersions(
    ...args: Parameters<PrismaCrmMessageDraftStore['listMessageDraftVersions']>
  ): ReturnType<PrismaCrmMessageDraftStore['listMessageDraftVersions']> {
    return this.messageDraftStore.listMessageDraftVersions(...args);
  }

  restoreMessageDraftVersion(
    ...args: Parameters<PrismaCrmMessageDraftStore['restoreMessageDraftVersion']>
  ): ReturnType<PrismaCrmMessageDraftStore['restoreMessageDraftVersion']> {
    return this.messageDraftStore.restoreMessageDraftVersion(...args);
  }

  approveMessageDraft(
    ...args: Parameters<PrismaCrmMessageDraftStore['approveMessageDraft']>
  ): ReturnType<PrismaCrmMessageDraftStore['approveMessageDraft']> {
    return this.messageDraftStore.approveMessageDraft(...args);
  }

  startFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['startFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['startFirstMessageSend']> {
    return this.sendStateStore.startFirstMessageSend(...args);
  }

  claimFirstMessageSendDelivery(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['claimFirstMessageSendDelivery']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['claimFirstMessageSendDelivery']> {
    return this.sendStateStore.claimFirstMessageSendDelivery(...args);
  }

  findQueuedMessageSendTarget(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['findQueuedMessageSendTarget']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['findQueuedMessageSendTarget']> {
    return this.sendStateStore.findQueuedMessageSendTarget(...args);
  }

  deferQueuedMessageSend(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['deferQueuedMessageSend']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['deferQueuedMessageSend']> {
    return this.sendStateStore.deferQueuedMessageSend(...args);
  }

  stopSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['stopSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['stopSequenceEnrollment']> {
    return this.sendStateStore.stopSequenceEnrollment(...args);
  }

  completeFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['completeFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['completeFirstMessageSend']> {
    return this.sendStateStore.completeFirstMessageSend(...args);
  }

  failFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceSendStateStore['failFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceSendStateStore['failFirstMessageSend']> {
    return this.sendStateStore.failFirstMessageSend(...args);
  }
}
