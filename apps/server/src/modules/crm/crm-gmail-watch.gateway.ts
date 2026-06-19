import type { CrmMailboxRecord } from './crm.types';

export interface CrmGmailWatchRenewInput {
  mailbox: CrmMailboxRecord;
}

export interface CrmGmailWatchRenewResult {
  historyId: string;
  watchExpiration: Date;
}

export interface CrmGmailWatchGateway {
  renewWatch(input: CrmGmailWatchRenewInput): Promise<CrmGmailWatchRenewResult>;
}

export class MockCrmGmailWatchGateway implements CrmGmailWatchGateway {
  /** Returns a deterministic-shaped mock watch renewal until the real Gmail API gateway is wired. */
  async renewWatch(input: CrmGmailWatchRenewInput): Promise<CrmGmailWatchRenewResult> {
    return {
      historyId: input.mailbox.lastHistoryId ?? '1',
      watchExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }
}
