import { getServiceBaseURL } from '@/utils/service';
import { localStg } from '@/utils/storage';
import { aiLeadSearchOrchestrateStreamUrl } from './ai-leads.shared';
import { flushLeadSearchStreamBuffer, parseLeadSearchStreamChunk } from './ai-leads.stream-parser';
/** Streams AI leads search progress events from the backend. */
export async function streamLeadCustomerSearch(data, handlers, options = {}) {
  try {
    const response = await fetch(buildLeadSearchStreamUrl(options.baseURL), {
      method: 'post',
      headers: buildLeadSearchStreamHeaders(),
      body: JSON.stringify(data),
      signal: options.signal
    });
    if (!response.ok) {
      throw new Error(`搜索采集请求失败：${response.status}`);
    }
    if (!response.body) {
      throw new Error('搜索采集响应不可读取');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer = parseLeadSearchStreamChunk(buffer, decoder.decode(value, { stream: true }), handlers.onEvent);
    }
    const rest = decoder.decode();
    if (rest) {
      buffer = parseLeadSearchStreamChunk(buffer, rest, handlers.onEvent);
    }
    flushLeadSearchStreamBuffer(buffer, handlers.onEvent);
    handlers.onComplete?.();
  } catch (error) {
    handlers.onError?.(error);
    throw error;
  }
}
function buildLeadSearchStreamHeaders() {
  const token = localStg.get('token');
  const authorization = token ? `Bearer ${token}` : '';
  const headers = {
    Accept: 'application/x-ndjson',
    'Content-Type': 'application/json'
  };
  if (authorization) {
    headers.Authorization = authorization;
  }
  return headers;
}
function buildLeadSearchStreamUrl(baseURL = getDefaultBaseURL()) {
  if (!baseURL) {
    return aiLeadSearchOrchestrateStreamUrl;
  }
  return `${baseURL.replace(/\/$/, '')}${aiLeadSearchOrchestrateStreamUrl}`;
}
function getDefaultBaseURL() {
  const env = import.meta.env || {};
  const isHttpProxy = Boolean(env.DEV && env.VITE_HTTP_PROXY === 'Y');
  return getServiceBaseURL(env, isHttpProxy).baseURL;
}
