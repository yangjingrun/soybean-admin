<script setup lang="ts">
import type { FormProps } from 'naive-ui';

type FilterPanelLabelPlacement = 'left' | 'top';

withDefaults(
  defineProps<{
    cols?: number | string;
    labelPlacement?: FilterPanelLabelPlacement;
    labelWidth?: number | string;
    model?: FormProps['model'];
    xGap?: number | string;
    yGap?: number | string;
  }>(),
  {
    cols: '1 s:2 m:3 l:4 xl:5',
    labelPlacement: 'left',
    labelWidth: 72,
    model: undefined,
    xGap: 12,
    yGap: 12
  }
);

defineSlots<{
  actions?: () => unknown;
  default?: () => unknown;
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NForm :model="model" :label-placement="labelPlacement" :label-width="labelWidth" :show-feedback="false">
      <NGrid responsive="screen" item-responsive :x-gap="xGap" :y-gap="yGap" :cols="cols">
        <slot></slot>
        <NGi suffix class="filter-panel-actions">
          <NSpace :size="8">
            <slot name="actions"></slot>
          </NSpace>
        </NGi>
      </NGrid>
    </NForm>
  </NCard>
</template>

<style scoped>
.filter-panel-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}
</style>
