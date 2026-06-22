import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import { createBuiltinVueRoutes } from './routes/builtin';
import { createRouterGuard } from './guard';
const { VITE_ROUTER_HISTORY_MODE = 'history', VITE_BASE_URL } = import.meta.env;
const historyCreatorMap = {
  hash: createWebHashHistory,
  history: createWebHistory,
  memory: createMemoryHistory
};
export const router = createRouter({
  history: historyCreatorMap[VITE_ROUTER_HISTORY_MODE](VITE_BASE_URL),
  routes: createBuiltinVueRoutes()
});
/** Setup Vue Router */
export async function setupRouter(app) {
  app.use(router);
  createRouterGuard(router);
  await router.isReady();
}
