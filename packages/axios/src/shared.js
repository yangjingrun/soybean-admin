export function getContentType(config) {
  const contentType = config.headers?.['Content-Type'] || 'application/json';
  return contentType;
}
/**
 * check if http status is success
 *
 * @param status
 */
export function isHttpSuccess(status) {
  const isSuccessCode = status >= 200 && status < 300;
  return isSuccessCode || status === 304;
}
/**
 * is response json
 *
 * @param response axios response
 */
export function isResponseJson(response) {
  const { responseType } = response.config;
  return responseType === 'json' || responseType === undefined;
}
export async function transformResponse(response) {
  const responseType = response.config?.responseType || 'json';
  if (responseType === 'json') return;
  const isJson = response.headers['content-type']?.includes('application/json');
  if (!isJson) return;
  if (responseType === 'blob') {
    await transformBlobToJson(response);
  }
  if (responseType === 'arrayBuffer') {
    await transformArrayBufferToJson(response);
  }
}
export async function transformBlobToJson(response) {
  try {
    let data = response.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (Object.prototype.toString.call(data) === '[object Blob]') {
      const json = await data.text();
      data = JSON.parse(json);
    }
    response.data = data;
  } catch {}
}
export async function transformArrayBufferToJson(response) {
  try {
    let data = response.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (Object.prototype.toString.call(data) === '[object ArrayBuffer]') {
      const json = new TextDecoder().decode(data);
      data = JSON.parse(json);
    }
    response.data = data;
  } catch {}
}
