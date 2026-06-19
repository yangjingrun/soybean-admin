import { Injectable, UnauthorizedException } from '@nestjs/common';

interface CrmGmailPubSubOidcTokenInfo {
  aud?: unknown;
  email?: unknown;
  email_verified?: unknown;
  exp?: unknown;
  iss?: unknown;
}

interface CrmGmailPubSubOidcTokenInfoResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type CrmGmailPubSubOidcTokenInfoFetch = (url: string) => Promise<CrmGmailPubSubOidcTokenInfoResponse>;

export interface CrmGmailPubSubOidcVerifyInput {
  token: string;
  audience: string;
  serviceAccountEmail: string;
}

const tokenInfoEndpoint = 'https://oauth2.googleapis.com/tokeninfo';
const googleOidcIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);

@Injectable()
export class CrmGmailPubSubOidcVerifier {
  constructor(private readonly tokenInfoFetch: CrmGmailPubSubOidcTokenInfoFetch = defaultTokenInfoFetch) {}

  /** Verifies Google Pub/Sub authenticated push OIDC claims through Google's tokeninfo endpoint. */
  async verify(input: CrmGmailPubSubOidcVerifyInput) {
    const tokenInfo = await this.loadTokenInfo(input.token);

    if (
      tokenInfo.aud !== input.audience ||
      tokenInfo.email !== input.serviceAccountEmail ||
      !isEmailVerified(tokenInfo.email_verified) ||
      !isAcceptedIssuer(tokenInfo.iss) ||
      isExpired(tokenInfo.exp)
    ) {
      throw new UnauthorizedException('Gmail Pub/Sub OIDC token 不匹配');
    }
  }

  private async loadTokenInfo(token: string): Promise<CrmGmailPubSubOidcTokenInfo> {
    const response = await this.tokenInfoFetch(`${tokenInfoEndpoint}?id_token=${encodeURIComponent(token)}`);

    if (!response.ok) {
      throw new UnauthorizedException('Gmail Pub/Sub OIDC token 无效');
    }

    const body = await response.json();

    if (!isRecord(body)) {
      throw new UnauthorizedException('Gmail Pub/Sub OIDC token 响应无效');
    }

    return body;
  }
}

function isEmailVerified(value: unknown) {
  return value === true || value === 'true';
}

function isAcceptedIssuer(value: unknown) {
  return typeof value === 'string' && googleOidcIssuers.has(value);
}

function isExpired(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  const expiresAtSeconds = Number(value);

  return Number.isFinite(expiresAtSeconds) && expiresAtSeconds * 1000 <= Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultTokenInfoFetch(url: string) {
  return fetch(url);
}
