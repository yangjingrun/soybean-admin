<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { SimpleScrollbar } from '@sa/materials';
import { GLOBAL_SIDER_MENU_ID } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { useRouteStore } from '@/store/modules/route';
import { useRouterPush } from '@/hooks/common/router';
import { useMenu } from '../context';

defineOptions({
  name: 'VerticalMenu'
});

const route = useRoute();
const appStore = useAppStore();
const themeStore = useThemeStore();
const routeStore = useRouteStore();
const { routerPushByKeyWithMetaQuery } = useRouterPush();
const { selectedKey } = useMenu();

const inverted = computed(() => !themeStore.darkMode && themeStore.sider.inverted);

const expandedKeys = ref<string[]>([]);

function updateExpandedKeys() {
  if (appStore.siderCollapse || !selectedKey.value) {
    expandedKeys.value = [];
    return;
  }
  expandedKeys.value = routeStore.getSelectedMenuKeyPath(selectedKey.value);
}

watch(
  () => route.name,
  () => {
    updateExpandedKeys();
  },
  { immediate: true }
);
</script>

<template>
  <Teleport :to="`#${GLOBAL_SIDER_MENU_ID}`">
    <SimpleScrollbar class="sider-menu-scrollbar">
      <NMenu
        v-model:expanded-keys="expandedKeys"
        class="sider-menu"
        mode="vertical"
        :value="selectedKey"
        :collapsed="appStore.siderCollapse"
        :collapsed-width="themeStore.sider.collapsedWidth"
        :collapsed-icon-size="22"
        :options="routeStore.menus"
        :inverted="inverted"
        :indent="18"
        @update:value="routerPushByKeyWithMetaQuery"
      />
    </SimpleScrollbar>
  </Teleport>
</template>

<style scoped>
.sider-menu-scrollbar {
  height: 100%;
  padding: 8px 10px 18px;
}

.sider-menu {
  --crm-sider-text: #4a5568;
  --crm-sider-muted: #748096;
  --crm-sider-primary: #4d55e8;
  --crm-sider-selected-bg: rgba(100, 108, 255, 0.12);
  --crm-sider-hover-bg: rgba(100, 108, 255, 0.08);
}

:deep(.sider-menu.n-menu) {
  padding: 0;
}

:deep(.sider-menu .n-menu-item) {
  margin: 2px 0;
}

:deep(.sider-menu .n-menu-item-content) {
  position: relative;
  height: 40px;
  margin: 0;
  border-radius: 8px;
  color: var(--crm-sider-text);
  font-weight: 600;
}

:deep(.sider-menu .n-menu-item-content::before) {
  right: 0;
  left: 0;
  border-radius: 8px;
}

:deep(.sider-menu .n-menu-item-content:hover::before) {
  background-color: var(--crm-sider-hover-bg);
}

:deep(.sider-menu .n-menu-item-content .n-menu-item-content__icon) {
  color: var(--crm-sider-muted);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

:deep(.sider-menu .n-menu-item-content:hover .n-menu-item-content__icon) {
  color: var(--crm-sider-primary);
}

:deep(.sider-menu .n-menu-item-content--selected),
:deep(.sider-menu .n-menu-item-content--child-active) {
  color: var(--crm-sider-primary);
}

:deep(.sider-menu .n-menu-item-content--selected::before) {
  background-color: var(--crm-sider-selected-bg);
}

:deep(.sider-menu .n-menu-item-content--selected::after) {
  position: absolute;
  top: 9px;
  bottom: 9px;
  left: 0;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(180deg, #646cff 0%, #1599ff 100%);
  content: '';
}

:deep(.sider-menu .n-menu-item-content--selected .n-menu-item-content__icon),
:deep(.sider-menu .n-menu-item-content--child-active .n-menu-item-content__icon) {
  color: var(--crm-sider-primary);
}

:deep(.sider-menu .n-menu-item-content--selected .n-menu-item-content-header),
:deep(.sider-menu .n-menu-item-content--child-active .n-menu-item-content-header) {
  color: var(--crm-sider-primary);
}

:deep(.sider-menu .n-submenu .n-menu-item-content) {
  font-weight: 600;
}

:deep(.sider-menu .n-menu-item-content-header) {
  letter-spacing: 0;
}
</style>
