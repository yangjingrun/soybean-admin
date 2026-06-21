import { BadGatewayException } from '@nestjs/common';
import type { SerperConfigRecord } from './ai-gateway.types';

export type SerperEndpoint = 'search' | 'places' | 'maps';

export interface SerperRequestBody {
  q: string;
  gl?: string;
  hl?: string;
  location?: string;
  num?: number;
  page?: number;
  tbs?: string;
  ll?: string;
  placeId?: string;
  cid?: string;
}

export type SerperFetch = (url: string, init: RequestInit) => Promise<Response>;

export class SerperClient {
  constructor(private readonly fetcher: SerperFetch = fetch) {}

  /** Calls Serper Search with the configured API key. */
  search(config: SerperConfigRecord, request: SerperRequestBody) {
    return this.request('search', config, request);
  }

  /** Calls Serper Places with the configured API key. */
  places(config: SerperConfigRecord, request: SerperRequestBody) {
    return this.request('places', config, request);
  }

  /** Calls Serper Maps with the configured API key. */
  maps(config: SerperConfigRecord, request: SerperRequestBody) {
    return this.request('maps', config, request);
  }

  private async request(endpoint: SerperEndpoint, config: SerperConfigRecord, request: SerperRequestBody) {
    const response = await this.fetcher(this.toEndpointUrl(config.apiBase, endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey
      },
      body: JSON.stringify(this.toRequestBody(request))
    });

    if (!response.ok) {
      throw new BadGatewayException(`Serper ${endpoint} 调用失败：${response.status}`);
    }

    return response.json() as Promise<unknown>;
  }

  private toEndpointUrl(apiBase: string, endpoint: SerperEndpoint) {
    return `${apiBase.replace(/\/+$/, '')}/${endpoint}`;
  }

  private toRequestBody(request: SerperRequestBody) {
    return Object.fromEntries(
      Object.entries(request).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
  }
}
