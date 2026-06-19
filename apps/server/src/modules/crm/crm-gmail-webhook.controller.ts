import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { CrmGmailWebhookService } from './crm-gmail-webhook.service';

@Controller('crm/gmail')
export class CrmGmailWebhookController {
  constructor(@Inject(CrmGmailWebhookService) private readonly webhookService: CrmGmailWebhookService) {}

  @Post('pubsub/push')
  async handlePubSubPush(@Body() payload: unknown, @Headers('x-crm-gmail-pubsub-secret') pushSecret = '') {
    const configuredSecret = normalizeSecret(process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET);
    const requestSecret = normalizeSecret(pushSecret);

    if (process.env.NODE_ENV === 'production' && !configuredSecret) {
      throw new UnauthorizedException('Gmail Pub/Sub push secret 未配置');
    }

    if (configuredSecret && requestSecret !== configuredSecret) {
      throw new UnauthorizedException('Gmail Pub/Sub push secret 不匹配');
    }

    return ok(await this.webhookService.handlePubSubPush(payload));
  }
}

/** Normalizes Pub/Sub push secrets so blank config is treated as missing. */
function normalizeSecret(value?: string) {
  const normalized = value?.trim();
  return normalized || null;
}
