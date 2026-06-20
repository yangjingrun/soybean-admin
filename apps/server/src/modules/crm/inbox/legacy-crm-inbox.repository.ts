import { Inject, Injectable } from '@nestjs/common';
import { CRM_STORE } from '../crm.tokens';
import type { CrmStore } from '../crm.types';
import type { CrmInboxRepository } from './crm-inbox.repository';

@Injectable()
export class LegacyCrmInboxRepository implements CrmInboxRepository {
  constructor(@Inject(CRM_STORE) private readonly store: CrmStore) {}

  getOrganizationConfig(
    ...args: Parameters<CrmStore['getOrganizationConfig']>
  ): ReturnType<CrmStore['getOrganizationConfig']> {
    return this.store.getOrganizationConfig(...args);
  }

  findProductLineById(
    ...args: Parameters<CrmStore['findProductLineById']>
  ): ReturnType<CrmStore['findProductLineById']> {
    return this.store.findProductLineById(...args);
  }

  findMessageById(...args: Parameters<CrmStore['findMessageById']>): ReturnType<CrmStore['findMessageById']> {
    return this.store.findMessageById(...args);
  }

  ingestCustomerReply(
    ...args: Parameters<CrmStore['ingestCustomerReply']>
  ): ReturnType<CrmStore['ingestCustomerReply']> {
    return this.store.ingestCustomerReply(...args);
  }

  listInboxThreads(...args: Parameters<CrmStore['listInboxThreads']>): ReturnType<CrmStore['listInboxThreads']> {
    return this.store.listInboxThreads(...args);
  }

  getInboxThread(...args: Parameters<CrmStore['getInboxThread']>): ReturnType<CrmStore['getInboxThread']> {
    return this.store.getInboxThread(...args);
  }

  updateInboxThreadStatus(
    ...args: Parameters<CrmStore['updateInboxThreadStatus']>
  ): ReturnType<CrmStore['updateInboxThreadStatus']> {
    return this.store.updateInboxThreadStatus(...args);
  }

  syncInboxThreadGmailState(
    ...args: Parameters<CrmStore['syncInboxThreadGmailState']>
  ): ReturnType<CrmStore['syncInboxThreadGmailState']> {
    return this.store.syncInboxThreadGmailState(...args);
  }

  confirmInboxMessageUnsubscribe(
    ...args: Parameters<CrmStore['confirmInboxMessageUnsubscribe']>
  ): ReturnType<CrmStore['confirmInboxMessageUnsubscribe']> {
    return this.store.confirmInboxMessageUnsubscribe(...args);
  }

  saveInboxThreadReplyDraft(
    ...args: Parameters<CrmStore['saveInboxThreadReplyDraft']>
  ): ReturnType<CrmStore['saveInboxThreadReplyDraft']> {
    return this.store.saveInboxThreadReplyDraft(...args);
  }

  replyInboxThread(...args: Parameters<CrmStore['replyInboxThread']>): ReturnType<CrmStore['replyInboxThread']> {
    return this.store.replyInboxThread(...args);
  }
}
