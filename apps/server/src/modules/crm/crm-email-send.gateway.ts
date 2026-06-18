import { Injectable } from '@nestjs/common';
import type { CrmEmailSendGateway, CrmEmailSendGatewayInput } from './crm.types';

@Injectable()
export class MockCrmEmailSendGateway implements CrmEmailSendGateway {
  /** Mock plain-text sending until the real Gmail API gateway is wired. */
  async sendPlainText(input: CrmEmailSendGatewayInput) {
    return {
      providerMessageId: `mock:${input.message.id}`
    };
  }
}
