import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmGmailWatchRepository } from '../crm-gmail-watch.repository';
import { PrismaCrmMailboxStore } from './prisma-crm-mailbox.store';

@Injectable()
export class PrismaCrmGmailWatchStore implements CrmGmailWatchRepository {
  private readonly mailboxStore: PrismaCrmMailboxStore;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
  }

  findMailboxById(
    ...args: Parameters<PrismaCrmMailboxStore['findMailboxById']>
  ): ReturnType<PrismaCrmMailboxStore['findMailboxById']> {
    return this.mailboxStore.findMailboxById(...args);
  }

  findMailboxByProviderAndEmailHash(
    ...args: Parameters<PrismaCrmMailboxStore['findMailboxByProviderAndEmailHash']>
  ): ReturnType<PrismaCrmMailboxStore['findMailboxByProviderAndEmailHash']> {
    return this.mailboxStore.findMailboxByProviderAndEmailHash(...args);
  }

  updateMailbox(
    ...args: Parameters<PrismaCrmMailboxStore['updateMailbox']>
  ): ReturnType<PrismaCrmMailboxStore['updateMailbox']> {
    return this.mailboxStore.updateMailbox(...args);
  }

  listMailboxesForWatchRenewal(
    ...args: Parameters<PrismaCrmMailboxStore['listMailboxesForWatchRenewal']>
  ): ReturnType<PrismaCrmMailboxStore['listMailboxesForWatchRenewal']> {
    return this.mailboxStore.listMailboxesForWatchRenewal(...args);
  }

  markMailboxAuthorizationExpired(
    ...args: Parameters<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']>
  ): ReturnType<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']> {
    return this.mailboxStore.markMailboxAuthorizationExpired(...args);
  }

  advanceMailboxHistoryId(
    ...args: Parameters<PrismaCrmMailboxStore['advanceMailboxHistoryId']>
  ): ReturnType<PrismaCrmMailboxStore['advanceMailboxHistoryId']> {
    return this.mailboxStore.advanceMailboxHistoryId(...args);
  }
}
