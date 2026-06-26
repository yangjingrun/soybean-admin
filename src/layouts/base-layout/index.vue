<script setup lang="ts">
import { computed, defineAsyncComponent, h, onBeforeUnmount, onMounted, watch } from 'vue';
import { NButton, useNotification } from 'naive-ui';
import { AdminLayout, LAYOUT_SCROLL_EL_ID } from '@sa/materials';
import type { LayoutMode } from '@sa/materials';
import { router } from '@/router';
import { useAppStore } from '@/store/modules/app';
import { useAiLeadsTaskNotificationStore } from '@/store/modules/ai-leads-task';
import { useThemeStore } from '@/store/modules/theme';
import GlobalHeader from '../modules/global-header/index.vue';
import GlobalSider from '../modules/global-sider/index.vue';
import GlobalTab from '../modules/global-tab/index.vue';
import GlobalContent from '../modules/global-content/index.vue';
import GlobalFooter from '../modules/global-footer/index.vue';
import ThemeDrawer from '../modules/theme-drawer/index.vue';
import { provideMixMenuContext } from '../modules/global-menu/context';
import { handleSystemNotificationRouteAction } from './system-notification-action';
import { resolveSystemNotificationDisplayPolicy } from './system-notification-display';

defineOptions({
  name: 'BaseLayout'
});

const appStore = useAppStore();
const themeStore = useThemeStore();
const notification = useNotification();
const taskNotificationStore = useAiLeadsTaskNotificationStore();
const activeNotificationIds = new Set<string>();
const { secondLevelMenus, childLevelMenus, isActiveFirstLevelMenuHasChildren } = provideMixMenuContext();

const GlobalMenu = defineAsyncComponent(() => import('../modules/global-menu/index.vue'));

const layoutMode = computed(() => {
  const vertical: LayoutMode = 'vertical';
  const horizontal: LayoutMode = 'horizontal';
  return themeStore.layout.mode.includes(vertical) ? vertical : horizontal;
});

const headerProps = computed(() => {
  const { mode } = themeStore.layout;

  const headerPropsConfig: Record<UnionKey.ThemeLayoutMode, App.Global.HeaderProps> = {
    vertical: {
      showLogo: false,
      showMenu: false,
      showMenuToggler: true
    },
    'vertical-mix': {
      showLogo: false,
      showMenu: false,
      showMenuToggler: false
    },
    'vertical-hybrid-header-first': {
      showLogo: !isActiveFirstLevelMenuHasChildren.value,
      showMenu: true,
      showMenuToggler: false
    },
    horizontal: {
      showLogo: true,
      showMenu: true,
      showMenuToggler: false
    },
    'top-hybrid-sidebar-first': {
      showLogo: true,
      showMenu: true,
      showMenuToggler: false
    },
    'top-hybrid-header-first': {
      showLogo: true,
      showMenu: true,
      showMenuToggler: isActiveFirstLevelMenuHasChildren.value
    }
  };

  return headerPropsConfig[mode];
});

const siderVisible = computed(() => themeStore.layout.mode !== 'horizontal');

const isVerticalMix = computed(() => themeStore.layout.mode === 'vertical-mix');

const isVerticalHybridHeaderFirst = computed(() => themeStore.layout.mode === 'vertical-hybrid-header-first');

const isTopHybridSidebarFirst = computed(() => themeStore.layout.mode === 'top-hybrid-sidebar-first');

const isTopHybridHeaderFirst = computed(() => themeStore.layout.mode === 'top-hybrid-header-first');

const siderWidth = computed(() => getSiderAndCollapsedWidth(false));

const siderCollapsedWidth = computed(() => getSiderAndCollapsedWidth(true));

function getSiderAndCollapsedWidth(isCollapsed: boolean) {
  const {
    mixChildMenuWidth,
    collapsedWidth,
    width: themeWidth,
    mixCollapsedWidth,
    mixWidth: themeMixWidth
  } = themeStore.sider;

  const width = isCollapsed ? collapsedWidth : themeWidth;
  const mixWidth = isCollapsed ? mixCollapsedWidth : themeMixWidth;

  if (isTopHybridHeaderFirst.value) {
    return isActiveFirstLevelMenuHasChildren.value ? width : 0;
  }

  if (isVerticalHybridHeaderFirst.value && !isActiveFirstLevelMenuHasChildren.value) {
    return 0;
  }

  const isMixMode = isVerticalMix.value || isTopHybridSidebarFirst.value || isVerticalHybridHeaderFirst.value;
  let finalWidth = isMixMode ? mixWidth : width;

  if (isVerticalMix.value && appStore.mixSiderFixed && secondLevelMenus.value.length) {
    finalWidth += mixChildMenuWidth;
  }

  if (isVerticalHybridHeaderFirst.value && appStore.mixSiderFixed && childLevelMenus.value.length) {
    finalWidth += mixChildMenuWidth;
  }

  return finalWidth;
}

onMounted(() => {
  taskNotificationStore.start();
});

onBeforeUnmount(() => {
  taskNotificationStore.stop();
});

watch(
  () => taskNotificationStore.notifications,
  notifications => {
    notifications.forEach(showSystemNotification);
  },
  { immediate: true }
);

/** Shows one task notification while keeping unread reminders eligible for later polling. */
function showSystemNotification(item: Api.SystemNotification.SystemNotification) {
  if (activeNotificationIds.has(item.id)) {
    return;
  }

  activeNotificationIds.add(item.id);
  const displayPolicy = resolveSystemNotificationDisplayPolicy(item);

  if (displayPolicy.mode === 'silent-read') {
    void taskNotificationStore.markRead(item.id).finally(() => {
      activeNotificationIds.delete(item.id);
    });
    return;
  }

  let destroyNotice: (() => void) | null = null;
  const routePath = item.routePath;
  const options = {
    title: item.title,
    content: item.content,
    meta: '系统通知',
    duration: displayPolicy.duration,
    keepAliveOnHover: true,
    onAfterLeave: () => {
      activeNotificationIds.delete(item.id);
    },
    action: routePath
      ? () =>
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              onClick: async () => {
                if (!destroyNotice) return;

                await handleSystemNotificationRouteAction({
                  id: item.id,
                  routePath,
                  destroyNotice,
                  markRead: taskNotificationStore.markRead,
                  pushRoute: path => router.push(path)
                });
              }
            },
            { default: () => '查看' }
          )
      : undefined
  };
  const notice = notification[displayPolicy.type](options);

  destroyNotice = () => notice.destroy();
  void taskNotificationStore.markShown(item.id);
}
</script>

<template>
  <AdminLayout
    v-model:sider-collapse="appStore.siderCollapse"
    :mode="layoutMode"
    :scroll-el-id="LAYOUT_SCROLL_EL_ID"
    :scroll-mode="themeStore.layout.scrollMode"
    :is-mobile="appStore.isMobile"
    :full-content="appStore.fullContent"
    :fixed-top="themeStore.fixedHeaderAndTab"
    :header-height="themeStore.header.height"
    :tab-visible="themeStore.tab.visible"
    :tab-height="themeStore.tab.height"
    :content-class="appStore.contentXScrollable ? 'overflow-x-hidden' : ''"
    :sider-visible="siderVisible"
    :sider-width="siderWidth"
    :sider-collapsed-width="siderCollapsedWidth"
    :footer-visible="themeStore.footer.visible"
    :footer-height="themeStore.footer.height"
    :fixed-footer="themeStore.footer.fixed"
    :right-footer="themeStore.footer.right"
  >
    <template #header>
      <GlobalHeader v-bind="headerProps" />
    </template>
    <template #tab>
      <GlobalTab />
    </template>
    <template #sider>
      <GlobalSider />
    </template>
    <GlobalMenu />
    <GlobalContent />
    <ThemeDrawer />
    <template #footer>
      <GlobalFooter />
    </template>
  </AdminLayout>
</template>

<style lang="scss">
#__SCROLL_EL_ID__ {
  @include scrollbar();
}
</style>
