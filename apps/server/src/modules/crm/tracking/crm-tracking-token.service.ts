import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppConfigService } from '../../app-config/app-config.service';

interface CrmTrackingTokenPayload {
  v: 1;
  messageId: string;
}

interface CrmTrackingConfigLike {
  config: {
    crmTrackingTokenSecret?: string;
  };
}

@Injectable()
export class CrmTrackingTokenService {
  constructor(@Optional() @Inject(AppConfigService) private readonly appConfig?: CrmTrackingConfigLike) {}

  /** Signs a CRM message id for public email open tracking URLs. */
  signMessageId(messageId: string) {
    const payload = Buffer.from(JSON.stringify({ v: 1, messageId } satisfies CrmTrackingTokenPayload)).toString(
      'base64url'
    );
    const signature = this.signPayload(payload);

    return `${payload}.${signature}`;
  }

  /** Verifies a public tracking token and returns its CRM message id. */
  verifyMessageToken(token: string) {
    const [payload, signature, extra] = token.split('.');

    if (!payload || !signature || extra !== undefined) {
      return null;
    }

    const expected = this.signPayloadOrNull(payload);

    if (!expected || !safeEqual(signature, expected)) {
      return null;
    }

    const parsed = parsePayload(payload);

    if (!parsed || parsed.v !== 1 || !parsed.messageId) {
      return null;
    }

    return parsed.messageId;
  }

  private signPayload(payload: string) {
    const secret = this.getSecret();

    if (!secret) {
      throw new Error('CRM_TRACKING_TOKEN_SECRET is required for CRM email open tracking');
    }

    return createHmac('sha256', secret).update(payload).digest('base64url');
  }

  private signPayloadOrNull(payload: string) {
    const secret = this.getSecret();

    if (!secret) {
      return null;
    }

    return createHmac('sha256', secret).update(payload).digest('base64url');
  }

  private getSecret() {
    return this.appConfig?.config.crmTrackingTokenSecret?.trim();
  }
}

function parsePayload(payload: string): CrmTrackingTokenPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CrmTrackingTokenPayload>;

    return typeof parsed.messageId === 'string' ? (parsed as CrmTrackingTokenPayload) : null;
  } catch {
    return null;
  }
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}
