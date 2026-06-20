import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmGmailHistorySyncRepository } from '../crm-gmail-history-sync.repository';
import { PrismaCrmAccountStore } from './prisma-crm-account.store';
import { PrismaCrmInboxStore } from './prisma-crm-inbox.store';
import { PrismaCrmMailboxStore } from './prisma-crm-mailbox.store';
import { PrismaCrmMessageDraftStore } from './prisma-crm-message-draft.store';

@Injectable()
export class PrismaCrmGmailHistorySyncStore implements CrmGmailHistorySyncRepository {
  private readonly accountStore: PrismaCrmAccountStore;
  private readonly inboxStore: PrismaCrmInboxStore;
  private readonly mailboxStore: PrismaCrmMailboxStore;
  private readonly messageDraftStore: PrismaCrmMessageDraftStore;

  constructor(prisma: PrismaService) {
    this.accountStore = new PrismaCrmAccountStore(prisma);
    this.inboxStore = new PrismaCrmInboxStore(prisma);
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
    this.messageDraftStore = new PrismaCrmMessageDraftStore(prisma);
  }

  findMailboxById(
    ...args: Parameters<PrismaCrmMailboxStore['findMailboxById']>
  ): ReturnType<PrismaCrmMailboxStore['findMailboxById']> {
    return this.mailboxStore.findMailboxById(...args);
  }

  updateMailbox(
    ...args: Parameters<PrismaCrmMailboxStore['updateMailbox']>
  ): ReturnType<PrismaCrmMailboxStore['updateMailbox']> {
    return this.mailboxStore.updateMailbox(...args);
  }

  advanceMailboxHistoryId(
    ...args: Parameters<PrismaCrmMailboxStore['advanceMailboxHistoryId']>
  ): ReturnType<PrismaCrmMailboxStore['advanceMailboxHistoryId']> {
    return this.mailboxStore.advanceMailboxHistoryId(...args);
  }

  markMailboxAuthorizationExpired(
    ...args: Parameters<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']>
  ): ReturnType<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']> {
    return this.mailboxStore.markMailboxAuthorizationExpired(...args);
  }

  ingestCustomerReply(
    ...args: Parameters<PrismaCrmInboxStore['ingestCustomerReply']>
  ): ReturnType<PrismaCrmInboxStore['ingestCustomerReply']> {
    return this.inboxStore.ingestCustomerReply(...args);
  }

  syncInboxThreadGmailState(
    ...args: Parameters<PrismaCrmInboxStore['syncInboxThreadGmailState']>
  ): ReturnType<PrismaCrmInboxStore['syncInboxThreadGmailState']> {
    return this.inboxStore.syncInboxThreadGmailState(...args);
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

  createTimelineEvent(
    ...args: Parameters<PrismaCrmAccountStore['createTimelineEvent']>
  ): ReturnType<PrismaCrmAccountStore['createTimelineEvent']> {
    return this.accountStore.createTimelineEvent(...args);
  }
}
