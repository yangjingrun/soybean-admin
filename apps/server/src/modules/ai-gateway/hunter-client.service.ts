import { BadGatewayException } from '@nestjs/common';
import type { HunterConfigRecord } from './ai-gateway.types';

export interface HunterDomainSearchRequest {
  domain: string;
  limit?: number;
  offset?: number;
}

export type HunterFetch = (url: string, init: RequestInit) => Promise<Response>;

export class HunterClient {
  constructor(private readonly fetcher: HunterFetch = fetch) {}

  /** Calls Hunter Domain Search for one company domain. */
  async domainSearch(config: HunterConfigRecord, request: HunterDomainSearchRequest) {
    const response = await this.fetcher(this.toDomainSearchUrl(config, request), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new BadGatewayException(`Hunter Domain Search 调用失败：${response.status}`);
    }

    return response.json() as Promise<unknown>;
  }

  private toDomainSearchUrl(config: HunterConfigRecord, request: HunterDomainSearchRequest) {
    const url = new URL(`${config.apiBase.replace(/\/+$/, '')}/domain-search`);
    url.searchParams.set('domain', request.domain);

    if (request.limit !== undefined) {
      url.searchParams.set('limit', String(request.limit));
    }

    if (request.offset !== undefined) {
      url.searchParams.set('offset', String(request.offset));
    }

    url.searchParams.set('api_key', config.apiKey);

    return url.toString();
  }
}
