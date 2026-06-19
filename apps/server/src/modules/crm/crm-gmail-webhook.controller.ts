import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { CrmGmailWebhookService } from './crm-gmail-webhook.service';

@Controller('crm/gmail')
export class CrmGmailWebhookController {
  constructor(@Inject(CrmGmailWebhookService) private readonly webhookService: CrmGmailWebhookService) {}

  @Post('pubsub/push')
  async handlePubSubPush(@Body() payload: unknown) {
    return ok(await this.webhookService.handlePubSubPush(payload));
  }
}
