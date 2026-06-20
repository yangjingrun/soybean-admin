import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmAccountRepository } from './crm-account.repository';

@Injectable()
export class LegacyCrmAccountRepository implements CrmAccountRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  findAccountByDomain(...args: Parameters<CrmStore['findAccountByDomain']>): ReturnType<CrmStore['findAccountByDomain']> {
    return this.store.findAccountByDomain(...args);
  }

  createAccount(...args: Parameters<CrmStore['createAccount']>): ReturnType<CrmStore['createAccount']> {
    return this.store.createAccount(...args);
  }

  updateAccount(...args: Parameters<CrmStore['updateAccount']>): ReturnType<CrmStore['updateAccount']> {
    return this.store.updateAccount(...args);
  }

  listAccountsForArchiveSlimming(
    ...args: Parameters<CrmStore['listAccountsForArchiveSlimming']>
  ): ReturnType<CrmStore['listAccountsForArchiveSlimming']> {
    return this.store.listAccountsForArchiveSlimming(...args);
  }

  slimArchivedAccount(...args: Parameters<CrmStore['slimArchivedAccount']>): ReturnType<CrmStore['slimArchivedAccount']> {
    return this.store.slimArchivedAccount(...args);
  }

  findContactByEmailHash(
    ...args: Parameters<CrmStore['findContactByEmailHash']>
  ): ReturnType<CrmStore['findContactByEmailHash']> {
    return this.store.findContactByEmailHash(...args);
  }

  createContact(...args: Parameters<CrmStore['createContact']>): ReturnType<CrmStore['createContact']> {
    return this.store.createContact(...args);
  }

  updateContact(...args: Parameters<CrmStore['updateContact']>): ReturnType<CrmStore['updateContact']> {
    return this.store.updateContact(...args);
  }

  findContactById(...args: Parameters<CrmStore['findContactById']>): ReturnType<CrmStore['findContactById']> {
    return this.store.findContactById(...args);
  }

  updateContactEmailStatus(
    ...args: Parameters<CrmStore['updateContactEmailStatus']>
  ): ReturnType<CrmStore['updateContactEmailStatus']> {
    return this.store.updateContactEmailStatus(...args);
  }

  findEmailVerificationCache(
    ...args: Parameters<CrmStore['findEmailVerificationCache']>
  ): ReturnType<CrmStore['findEmailVerificationCache']> {
    return this.store.findEmailVerificationCache(...args);
  }

  upsertEmailVerificationCache(
    ...args: Parameters<CrmStore['upsertEmailVerificationCache']>
  ): ReturnType<CrmStore['upsertEmailVerificationCache']> {
    return this.store.upsertEmailVerificationCache(...args);
  }

  findArchivedFingerprints(
    ...args: Parameters<CrmStore['findArchivedFingerprints']>
  ): ReturnType<CrmStore['findArchivedFingerprints']> {
    return this.store.findArchivedFingerprints(...args);
  }

  upsertArchivedFingerprint(
    ...args: Parameters<CrmStore['upsertArchivedFingerprint']>
  ): ReturnType<CrmStore['upsertArchivedFingerprint']> {
    return this.store.upsertArchivedFingerprint(...args);
  }

  listAccounts(...args: Parameters<CrmStore['listAccounts']>): ReturnType<CrmStore['listAccounts']> {
    return this.store.listAccounts(...args);
  }

  getAccountDetail(...args: Parameters<CrmStore['getAccountDetail']>): ReturnType<CrmStore['getAccountDetail']> {
    return this.store.getAccountDetail(...args);
  }

  createTimelineEvent(...args: Parameters<CrmStore['createTimelineEvent']>): ReturnType<CrmStore['createTimelineEvent']> {
    return this.store.createTimelineEvent(...args);
  }
}
