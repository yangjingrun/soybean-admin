import type { RouteMeta } from 'vue-router';
import ElegantVueRouter from '@elegant-router/vue/vite';
import type { RouteKey } from '@elegant-router/types';

export function setupElegantRouter() {
  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',
      blank: 'src/layouts/blank-layout/index.vue'
    },
    routePathTransformer(routeName, routePath) {
      const key = routeName as RouteKey;

      if (key === 'login') {
        const modules: UnionKey.LoginModule[] = ['pwd-login', 'code-login', 'register', 'reset-pwd', 'bind-wechat'];

        const moduleReg = modules.join('|');

        return `/login/:module(${moduleReg})?`;
      }

      return routePath;
    },
    onRouteMetaGen(routeName) {
      const key = routeName as RouteKey;

      const constantRoutes: RouteKey[] = ['login', '403', '404', '500'];

      const meta: Partial<RouteMeta> = {
        title: key,
        i18nKey: `route.${key}` as App.I18n.I18nKey
      };

      if (constantRoutes.includes(key)) {
        meta.constant = true;
      }

      if (key === 'home') {
        meta.icon = 'mdi:monitor-dashboard';
        meta.order = 1;
      }

      if (key === 'ai-assistant') {
        meta.icon = 'mdi:robot-happy-outline';
        meta.order = 2;
      }

      if (key === 'ai-leads') {
        meta.icon = 'mdi:account-search-outline';
        meta.order = 3;
        meta.keepAlive = true;
      }

      if (key === 'ai-settings') {
        meta.icon = 'mdi:server-network-outline';
        meta.order = 7;
      }

      if (key === 'ai-prompt-settings') {
        meta.icon = 'mdi:file-document-edit-outline';
        meta.order = 4;
        meta.permissions = ['ai:settings:prompt:manage'];
      }

      if (key === 'crm') {
        meta.icon = 'mdi:account-box-multiple-outline';
        meta.order = 5;
      }

      if (key === 'crm_leads') {
        meta.icon = 'mdi:account-multiple-outline';
        meta.order = 1;
      }

      if (key === 'crm_email-sequences') {
        meta.icon = 'mdi:email-sync-outline';
        meta.order = 2;
      }

      if (key === 'crm_inbox') {
        meta.icon = 'mdi:inbox-full-outline';
        meta.order = 3;
      }

      if (key === 'crm_settings') {
        meta.icon = 'mdi:cog-outline';
        meta.order = 4;
        meta.permissions = [
          'crm:settings:assets:read',
          'crm:settings:assets:write',
          'crm:settings:rules:read',
          'crm:settings:rules:write',
          'crm:settings:safety:read',
          'crm:settings:safety:write',
          'crm:settings:global:write',
          'crm:settings:ai-draft-queue:write',
          'crm:settings:operations:write'
        ];
      }

      if (key === 'crm_gmail-oauth-callback') {
        meta.hideInMenu = true;
        meta.activeMenu = 'crm_settings';
      }

      if (key === 'manage') {
        meta.icon = 'carbon:cloud-service-management';
        meta.order = 6;
        meta.roles = ['R_SUPER'];
      }

      if (key === 'manage_organization') {
        meta.icon = 'mdi:office-building-cog-outline';
        meta.order = 1;
        meta.roles = ['R_SUPER'];
      }

      if (key === 'manage_user') {
        meta.icon = 'ic:round-manage-accounts';
        meta.order = 2;
        meta.roles = ['R_SUPER'];
      }

      if (key === 'manage_role') {
        meta.icon = 'mdi:account-key-outline';
        meta.order = 3;
        meta.roles = ['R_SUPER'];
      }

      if (key === 'manage_permission') {
        meta.icon = 'mdi:shield-key-outline';
        meta.order = 4;
        meta.roles = ['R_SUPER'];
      }

      if (key === 'manage_system-log') {
        meta.icon = 'mdi:clipboard-text-clock-outline';
        meta.order = 5;
        meta.roles = ['R_SUPER'];
      }

      return meta;
    }
  });
}
