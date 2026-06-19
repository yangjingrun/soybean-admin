import { Injectable } from '@nestjs/common';
import type { CrmEmailSendGateway, CrmEmailSendGatewayInput } from './crm.types';

@Injectable()
export class MockCrmEmailSendGateway implements CrmEmailSendGateway {
  /** Mock plain-text sending until the real Gmail API gateway is wired. */
  async sendPlainText(input: CrmEmailSendGatewayInput) {
    return {
      providerMessageId: `mock:${input.message.id}`,
      providerThreadId: `mock-thread:${input.enrollment.id}`
    };
  }

  /** Mock plain-text inbox reply until the real Gmail thread reply API is wired. */
  async replyPlainText(input: Parameters<CrmEmailSendGateway['replyPlainText']>[0]) {
    return {
      providerMessageId: `mock:reply:${input.thread.id}:${Date.now()}`,
      providerThreadId: input.thread.providerThreadId ?? `mock-thread:${input.thread.id}`
    };
  }
}
