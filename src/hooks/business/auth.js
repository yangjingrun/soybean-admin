import { useAuthStore } from '@/store/modules/auth';
export function useAuth() {
  const authStore = useAuthStore();
  function hasAuth(codes) {
    if (!authStore.isLogin) {
      return false;
    }
    if (typeof codes === 'string') {
      return authStore.userInfo.buttons.includes(codes);
    }
    return codes.some(code => authStore.userInfo.buttons.includes(code));
  }
  return {
    hasAuth
  };
}
