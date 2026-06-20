import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmSequenceRepository } from './crm-sequence.repository';

@Injectable()
export class LegacyCrmSequenceRepository implements CrmSequenceRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  countOwnerQueuedMessages(
    ...args: Parameters<CrmStore['countOwnerQueuedMessages']>
  ): ReturnType<CrmStore['countOwnerQueuedMessages']> {
    return this.store.countOwnerQueuedMessages(...args);
  }

  countDispatchedMessages(
    ...args: Parameters<CrmStore['countDispatchedMessages']>
  ): ReturnType<CrmStore['countDispatchedMessages']> {
    return this.store.countDispatchedMessages(...args);
  }

  listOwnerSendStates(...args: Parameters<CrmStore['listOwnerSendStates']>): ReturnType<CrmStore['listOwnerSendStates']> {
    return this.store.listOwnerSendStates(...args);
  }

  listMailboxSendStates(
    ...args: Parameters<CrmStore['listMailboxSendStates']>
  ): ReturnType<CrmStore['listMailboxSendStates']> {
    return this.store.listMailboxSendStates(...args);
  }

  listDueSendCandidates(
    ...args: Parameters<CrmStore['listDueSendCandidates']>
  ): ReturnType<CrmStore['listDueSendCandidates']> {
    return this.store.listDueSendCandidates(...args);
  }

  listStaleQueuedMessages(
    ...args: Parameters<CrmStore['listStaleQueuedMessages']>
  ): ReturnType<CrmStore['listStaleQueuedMessages']> {
    return this.store.listStaleQueuedMessages(...args);
  }

  findActiveEnrollmentByContact(
    ...args: Parameters<CrmStore['findActiveEnrollmentByContact']>
  ): ReturnType<CrmStore['findActiveEnrollmentByContact']> {
    return this.store.findActiveEnrollmentByContact(...args);
  }

  findActiveEnrollmentByAccount(
    ...args: Parameters<CrmStore['findActiveEnrollmentByAccount']>
  ): ReturnType<CrmStore['findActiveEnrollmentByAccount']> {
    return this.store.findActiveEnrollmentByAccount(...args);
  }

  createSequenceEnrollment(
    ...args: Parameters<CrmStore['createSequenceEnrollment']>
  ): ReturnType<CrmStore['createSequenceEnrollment']> {
    return this.store.createSequenceEnrollment(...args);
  }

  createSequenceDraftBundle(
    ...args: Parameters<CrmStore['createSequenceDraftBundle']>
  ): ReturnType<CrmStore['createSequenceDraftBundle']> {
    return this.store.createSequenceDraftBundle(...args);
  }

  createFollowUpDraftBundle(
    ...args: Parameters<CrmStore['createFollowUpDraftBundle']>
  ): ReturnType<CrmStore['createFollowUpDraftBundle']> {
    return this.store.createFollowUpDraftBundle(...args);
  }

  listSequenceReviewItems(
    ...args: Parameters<CrmStore['listSequenceReviewItems']>
  ): ReturnType<CrmStore['listSequenceReviewItems']> {
    return this.store.listSequenceReviewItems(...args);
  }

  getSequenceReviewItem(
    ...args: Parameters<CrmStore['getSequenceReviewItem']>
  ): ReturnType<CrmStore['getSequenceReviewItem']> {
    return this.store.getSequenceReviewItem(...args);
  }

  listSequenceReviewItemsByIds(
    ...args: Parameters<CrmStore['listSequenceReviewItemsByIds']>
  ): ReturnType<CrmStore['listSequenceReviewItemsByIds']> {
    return this.store.listSequenceReviewItemsByIds(...args);
  }

  updateSequenceEnrollment(
    ...args: Parameters<CrmStore['updateSequenceEnrollment']>
  ): ReturnType<CrmStore['updateSequenceEnrollment']> {
    return this.store.updateSequenceEnrollment(...args);
  }

  createMessage(...args: Parameters<CrmStore['createMessage']>): ReturnType<CrmStore['createMessage']> {
    return this.store.createMessage(...args);
  }

  findMessageById(...args: Parameters<CrmStore['findMessageById']>): ReturnType<CrmStore['findMessageById']> {
    return this.store.findMessageById(...args);
  }

  findSentMessageByProviderId(
    ...args: Parameters<CrmStore['findSentMessageByProviderId']>
  ): ReturnType<CrmStore['findSentMessageByProviderId']> {
    return this.store.findSentMessageByProviderId(...args);
  }

  findSentMessageByProviderThreadId(
    ...args: Parameters<CrmStore['findSentMessageByProviderThreadId']>
  ): ReturnType<CrmStore['findSentMessageByProviderThreadId']> {
    return this.store.findSentMessageByProviderThreadId(...args);
  }

  updateMessage(...args: Parameters<CrmStore['updateMessage']>): ReturnType<CrmStore['updateMessage']> {
    return this.store.updateMessage(...args);
  }

  createMessageDraftVersion(
    ...args: Parameters<CrmStore['createMessageDraftVersion']>
  ): ReturnType<CrmStore['createMessageDraftVersion']> {
    return this.store.createMessageDraftVersion(...args);
  }

  listMessageDraftVersions(
    ...args: Parameters<CrmStore['listMessageDraftVersions']>
  ): ReturnType<CrmStore['listMessageDraftVersions']> {
    return this.store.listMessageDraftVersions(...args);
  }

  restoreMessageDraftVersion(
    ...args: Parameters<CrmStore['restoreMessageDraftVersion']>
  ): ReturnType<CrmStore['restoreMessageDraftVersion']> {
    return this.store.restoreMessageDraftVersion(...args);
  }

  approveMessageDraft(
    ...args: Parameters<CrmStore['approveMessageDraft']>
  ): ReturnType<CrmStore['approveMessageDraft']> {
    return this.store.approveMessageDraft(...args);
  }

  startFirstMessageSend(
    ...args: Parameters<CrmStore['startFirstMessageSend']>
  ): ReturnType<CrmStore['startFirstMessageSend']> {
    return this.store.startFirstMessageSend(...args);
  }

  claimFirstMessageSendDelivery(
    ...args: Parameters<CrmStore['claimFirstMessageSendDelivery']>
  ): ReturnType<CrmStore['claimFirstMessageSendDelivery']> {
    return this.store.claimFirstMessageSendDelivery(...args);
  }

  stopSequenceEnrollment(
    ...args: Parameters<CrmStore['stopSequenceEnrollment']>
  ): ReturnType<CrmStore['stopSequenceEnrollment']> {
    return this.store.stopSequenceEnrollment(...args);
  }

  completeFirstMessageSend(
    ...args: Parameters<CrmStore['completeFirstMessageSend']>
  ): ReturnType<CrmStore['completeFirstMessageSend']> {
    return this.store.completeFirstMessageSend(...args);
  }

  failFirstMessageSend(
    ...args: Parameters<CrmStore['failFirstMessageSend']>
  ): ReturnType<CrmStore['failFirstMessageSend']> {
    return this.store.failFirstMessageSend(...args);
  }

  createAiDraftTask(...args: Parameters<CrmStore['createAiDraftTask']>): ReturnType<CrmStore['createAiDraftTask']> {
    return this.store.createAiDraftTask(...args);
  }

  countActiveAiDraftTasksForUser(
    ...args: Parameters<CrmStore['countActiveAiDraftTasksForUser']>
  ): ReturnType<CrmStore['countActiveAiDraftTasksForUser']> {
    return this.store.countActiveAiDraftTasksForUser(...args);
  }

  countActiveAiDraftTasksForOrg(
    ...args: Parameters<CrmStore['countActiveAiDraftTasksForOrg']>
  ): ReturnType<CrmStore['countActiveAiDraftTasksForOrg']> {
    return this.store.countActiveAiDraftTasksForOrg(...args);
  }

  findCurrentAiDraftTaskForUser(
    ...args: Parameters<CrmStore['findCurrentAiDraftTaskForUser']>
  ): ReturnType<CrmStore['findCurrentAiDraftTaskForUser']> {
    return this.store.findCurrentAiDraftTaskForUser(...args);
  }

  findAiDraftTaskById(
    ...args: Parameters<CrmStore['findAiDraftTaskById']>
  ): ReturnType<CrmStore['findAiDraftTaskById']> {
    return this.store.findAiDraftTaskById(...args);
  }

  listAiDraftTasks(...args: Parameters<CrmStore['listAiDraftTasks']>): ReturnType<CrmStore['listAiDraftTasks']> {
    return this.store.listAiDraftTasks(...args);
  }

  listAiDraftTaskItems(
    ...args: Parameters<CrmStore['listAiDraftTaskItems']>
  ): ReturnType<CrmStore['listAiDraftTaskItems']> {
    return this.store.listAiDraftTaskItems(...args);
  }

  updateAiDraftTask(...args: Parameters<CrmStore['updateAiDraftTask']>): ReturnType<CrmStore['updateAiDraftTask']> {
    return this.store.updateAiDraftTask(...args);
  }

  updateAiDraftTaskItem(
    ...args: Parameters<CrmStore['updateAiDraftTaskItem']>
  ): ReturnType<CrmStore['updateAiDraftTaskItem']> {
    return this.store.updateAiDraftTaskItem(...args);
  }
}
