<script setup lang="ts">
import { computed } from 'vue';
import { GLOBAL_SIDER_MENU_ID } from '@/constants/app';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import GlobalLogo from '../global-logo/index.vue';

defineOptions({
  name: 'GlobalSider'
});

const appStore = useAppStore();
const themeStore = useThemeStore();

const isTopHybridSidebarFirst = computed(() => themeStore.layout.mode === 'top-hybrid-sidebar-first');
const isTopHybridHeaderFirst = computed(() => themeStore.layout.mode === 'top-hybrid-header-first');
const darkMenu = computed(
  () =>
    !themeStore.darkMode && !isTopHybridSidebarFirst.value && !isTopHybridHeaderFirst.value && themeStore.sider.inverted
);
const showLogo = computed(() => themeStore.layout.mode === 'vertical');
const menuWrapperClass = computed(() => (showLogo.value ? 'flex-1-hidden' : 'h-full'));
</script>

<template>
  <DarkModeContainer
    class="global-sider-shell size-full flex-col-stretch"
    :class="{ 'global-sider-shell--collapsed': appStore.siderCollapse }"
    :inverted="darkMenu"
  >
    <GlobalLogo
      v-if="showLogo"
      class="global-sider-logo"
      :show-title="!appStore.siderCollapse"
      :style="{ height: themeStore.header.height + 'px' }"
    />
    <div :id="GLOBAL_SIDER_MENU_ID" :class="menuWrapperClass"></div>
  </DarkModeContainer>
</template>

<style scoped>
.global-sider-shell {
  position: relative;
  overflow: hidden;
  border-right: 1px solid #e7eaf5;
  background:
    linear-gradient(180deg, rgba(248, 250, 255, 0.98) 0%, rgba(255, 255, 255, 0.96) 34%),
    radial-gradient(circle at 18px 18px, rgba(100, 108, 255, 0.1), transparent 30%);
  box-shadow: 10px 0 30px rgba(42, 55, 120, 0.06);
}

.global-sider-shell::before {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, rgba(100, 108, 255, 0.34), rgba(100, 108, 255, 0.04));
  content: '';
}

.global-sider-logo {
  flex-shrink: 0;
  margin: 8px 10px 6px;
}

.global-sider-shell--collapsed .global-sider-logo {
  margin-inline: 8px;
}

.global-sider-shell--collapsed :deep(.global-logo) {
  justify-content: center;
  padding: 0;
}
</style>
