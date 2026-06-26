<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'GlobalLogo'
});

interface Props {
  /** Whether to show the title */
  showTitle?: boolean;
}

withDefaults(defineProps<Props>(), {
  showTitle: true
});
</script>

<template>
  <RouterLink to="/" class="global-logo w-full flex-center nowrap-hidden">
    <span class="global-logo__mark">
      <SystemLogo class="size-30px" />
    </span>
    <h2 v-show="showTitle" class="global-logo__title transition duration-300 ease-in-out">
      {{ $t('system.title') }}
    </h2>
  </RouterLink>
</template>

<style scoped>
.global-logo {
  justify-content: flex-start;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid rgba(100, 108, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 10px 24px rgba(63, 74, 170, 0.08);
}

.global-logo__mark {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(100, 108, 255, 0.14), rgba(21, 153, 255, 0.08));
}

.global-logo__title {
  min-width: 0;
  padding-left: 8px;
  overflow: hidden;
  color: #3f46cf;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
