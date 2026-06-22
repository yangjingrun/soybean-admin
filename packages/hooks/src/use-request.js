import { ref } from 'vue';
import { createFlatRequest } from '@sa/axios';
import useLoading from './use-loading';
/**
 * create a hook request instance
 *
 * @param axiosConfig
 * @param options
 */
export default function createHookRequest(axiosConfig, options) {
  const request = createFlatRequest(axiosConfig, options);
  const hookRequest = function hookRequest(config) {
    const { loading, startLoading, endLoading } = useLoading();
    const data = ref(null);
    const error = ref(null);
    startLoading();
    request(config).then(res => {
      if (res.data) {
        data.value = res.data;
      } else {
        error.value = res.error;
      }
      endLoading();
    });
    return {
      loading,
      data,
      error
    };
  };
  hookRequest.cancelAllRequest = request.cancelAllRequest;
  return hookRequest;
}
