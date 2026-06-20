import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmMailboxRepository } from './crm-mailbox.repository';

@Injectable()
export class LegacyCrmMailboxRepository implements CrmMailboxRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  findMailboxByProviderAndEmailHash(
    ...args: Parameters<CrmStore['findMailboxByProviderAndEmailHash']>
  ): ReturnType<CrmStore['findMailboxByProviderAndEmailHash']> {
    return this.store.findMailboxByProviderAndEmailHash(...args);
  }

  createMailbox(...args: Parameters<CrmStore['createMailbox']>): ReturnType<CrmStore['createMailbox']> {
    return this.store.createMailbox(...args);
  }

  listMailboxes(...args: Parameters<CrmStore['listMailboxes']>): ReturnType<CrmStore['listMailboxes']> {
    return this.store.listMailboxes(...args);
  }

  findMailboxById(...args: Parameters<CrmStore['findMailboxById']>): ReturnType<CrmStore['findMailboxById']> {
    return this.store.findMailboxById(...args);
  }

  updateMailbox(...args: Parameters<CrmStore['updateMailbox']>): ReturnType<CrmStore['updateMailbox']> {
    return this.store.updateMailbox(...args);
  }

  listMailboxesForWatchRenewal(
    ...args: Parameters<CrmStore['listMailboxesForWatchRenewal']>
  ): ReturnType<CrmStore['listMailboxesForWatchRenewal']> {
    return this.store.listMailboxesForWatchRenewal(...args);
  }

  markMailboxAuthorizationExpired(
    ...args: Parameters<CrmStore['markMailboxAuthorizationExpired']>
  ): ReturnType<CrmStore['markMailboxAuthorizationExpired']> {
    return this.store.markMailboxAuthorizationExpired(...args);
  }

  advanceMailboxHistoryId(
    ...args: Parameters<CrmStore['advanceMailboxHistoryId']>
  ): ReturnType<CrmStore['advanceMailboxHistoryId']> {
    return this.store.advanceMailboxHistoryId(...args);
  }
}
