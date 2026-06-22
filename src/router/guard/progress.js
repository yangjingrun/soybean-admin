export function createProgressGuard(router) {
  router.beforeEach(() => {
    window.NProgress?.start?.();
    return;
  });
  router.afterEach(() => {
    window.NProgress?.done?.();
  });
}
