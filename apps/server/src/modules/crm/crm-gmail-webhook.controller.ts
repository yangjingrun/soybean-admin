import { Body, Controller, Headers, Inject, Optional, Post, UnauthorizedException } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { Public } from '../auth/auth.decorators';
import { CrmGmailPubSubOidcVerifier } from './crm-gmail-pubsub-oidc.verifier';
import { CrmGmailWebhookService } from './crm-gmail-webhook.service';

@Controller('crm/gmail')
export class CrmGmailWebhookController {
  constructor(
    @Inject(CrmGmailWebhookService) private readonly webhookService: CrmGmailWebhookService,
    @Optional() @Inject(CrmGmailPubSubOidcVerifier) private readonly oidcVerifier?: CrmGmailPubSubOidcVerifier
  ) {}

  @Post('pubsub/push')
  @Public()
  async handlePubSubPush(
    @Body() payload: unknown,
    @Headers('x-crm-gmail-pubsub-secret') pushSecret = '',
    @Headers('authorization') authorization = ''
  ) {
    const configuredSecret = normalizeSecret(process.env.CRM_GMAIL_PUBSUB_PUSH_SECRET);
    const requestSecret = normalizeSecret(pushSecret);

    if (process.env.NODE_ENV === 'production' && !configuredSecret) {
      throw new UnauthorizedException('Gmail Pub/Sub push secret 未配置');
    }

    if (configuredSecret && requestSecret !== configuredSecret) {
      throw new UnauthorizedException('Gmail Pub/Sub push secret 不匹配');
    }

    await this.verifyOidcAuthorization(authorization);

    return ok(await this.webhookService.handlePubSubPush(payload));
  }

  private async verifyOidcAuthorization(authorization: string) {
    const audience = normalizeSecret(process.env.CRM_GMAIL_PUBSUB_AUTH_AUDIENCE);
    const serviceAccountEmail = normalizeSecret(process.env.CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT);

    if (!audience && !serviceAccountEmail) {
      return;
    }

    if (!audience || !serviceAccountEmail) {
      throw new UnauthorizedException('Gmail Pub/Sub OIDC 配置不完整');
    }

    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('Gmail Pub/Sub OIDC token 缺失');
    }

    if (!this.oidcVerifier) {
      throw new UnauthorizedException('Gmail Pub/Sub OIDC verifier 未启用');
    }

    await this.oidcVerifier.verify({
      token,
      audience,
      serviceAccountEmail
    });
  }
}

/** Normalizes Pub/Sub push secrets so blank config is treated as missing. */
function normalizeSecret(value?: string) {
  const normalized = value?.trim();
  return normalized || null;
}

/** Extracts a bearer token from the Pub/Sub push Authorization header. */
function extractBearerToken(authorization: string) {
  const [type, token] = authorization.trim().split(/\s+/);

  if (type !== 'Bearer' || !token) {
    return null;
  }

  return token;
}
