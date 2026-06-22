import { createAlova } from 'alova';
import VueHook from 'alova/vue';
import adapterFetch from 'alova/fetch';
import { createServerTokenAuthentication } from 'alova/client';
import { BACKEND_ERROR_CODE } from './constant';
export const createAlovaRequest = (customConfig, options) => {
  const { tokenRefresher } = options;
  const { onAuthRequired, onResponseRefreshToken } = createServerTokenAuthentication({
    refreshTokenOnSuccess: {
      isExpired: (response, method) => tokenRefresher?.isExpired(response, method) || false,
      handler: async (response, method) => tokenRefresher?.handler(response, method)
    },
    refreshTokenOnError: {
      isExpired: (response, method) => tokenRefresher?.isExpired(response, method) || false,
      handler: async (response, method) => tokenRefresher?.handler(response, method)
    }
  });
  const instance = createAlova({
    ...customConfig,
    timeout: customConfig.timeout ?? 10 * 1000,
    requestAdapter: customConfig.requestAdapter ?? adapterFetch(),
    statesHook: VueHook,
    beforeRequest: onAuthRequired(options.onRequest),
    responded: onResponseRefreshToken({
      onSuccess: async (response, method) => {
        // check if http status is success
        let error = null;
        let transformedData = null;
        try {
          if (await options.isBackendSuccess(response)) {
            transformedData = await options.transformBackendResponse(response);
          } else {
            error = new Error('the backend request error');
            error.code = BACKEND_ERROR_CODE;
          }
        } catch (err) {
          error = err;
        }
        if (error) {
          await options.onError?.(error, response, method);
          throw error;
        }
        return transformedData;
      },
      onComplete: options.onComplete,
      onError: (error, method) => options.onError?.(error, null, method)
    })
  });
  return instance;
};
export { BACKEND_ERROR_CODE };
