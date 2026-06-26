import { computed, shallowRef } from 'vue';
import { useLoading } from '@sa/hooks';
import { fetchImageCaptcha } from '@/service/api';

export function useImageCaptcha() {
  const { loading, startLoading, endLoading } = useLoading();
  const captchaId = shallowRef('');
  const captchaSvg = shallowRef('');

  const captchaImageSrc = computed(() => {
    if (!captchaSvg.value) {
      return '';
    }

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg.value)}`;
  });

  /** Refresh the image captcha used by password login. */
  async function refreshCaptcha() {
    startLoading();

    const { data, error } = await fetchImageCaptcha();

    if (!error) {
      captchaId.value = data.captchaId;
      captchaSvg.value = data.svg;
    }

    endLoading();
  }

  return {
    loading,
    captchaId,
    captchaImageSrc,
    refreshCaptcha
  };
}
