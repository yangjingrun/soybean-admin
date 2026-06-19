import { Injectable } from '@nestjs/common';
import type { CrmGmailHistoryGateway } from './crm.types';

@Injectable()
export class MockCrmGmailHistoryGateway implements CrmGmailHistoryGateway {
  async listHistory(input: Parameters<CrmGmailHistoryGateway['listHistory']>[0]) {
    return { nextHistoryId: input.targetHistoryId };
  }
}
