<script setup lang="ts">
import { computed, h, type CSSProperties, type VNodeChild } from 'vue';
import type { CascaderOption } from 'naive-ui';
import { useCrmRegionCascader } from '@/hooks/business/crm-region-cascader';
import type { CrmRegionCascaderOption } from '@/utils/crm-region-cascader';

defineOptions({ name: 'CrmRegionCascader' });

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    placeholder: '国家 / 地区 / 城市'
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const {
  clearRegionSearch,
  filterCrmRegionOption,
  handleRegionDropdownShow,
  regionLoading,
  regionOptions
} = useCrmRegionCascader();

const cascaderValue = computed(() => props.modelValue || null);
const cascaderDisabled = computed(() => props.disabled || regionLoading.value);
const dropdownStyle = {
  // 国家-地区-城市层级较长，放大弹层高度减少滚动成本。
  '--n-menu-height': 'min(72vh, 560px)'
} as CSSProperties;
const dropdownMenuProps = {
  class: 'crm-region-cascader-menu',
  style: dropdownStyle
};
const filterDropdownMenuProps = {
  class: 'crm-region-cascader-menu',
  style: dropdownStyle
};

function handleRegionUpdate(value: string | number | null) {
  emit('update:modelValue', typeof value === 'string' ? value : '');
  clearRegionSearch();
}

function getRegionColumnStyle(): CSSProperties {
  return {
    width: 'max-content',
    minWidth: '220px'
  };
}

function renderRegionLabel(option: CascaderOption): VNodeChild {
  const regionOption = option as CrmRegionCascaderOption;
  const label = String(regionOption.label ?? '');

  if (regionOption.nodeType !== 'country' || !regionOption.flag) {
    return label;
  }

  return h('span', { class: 'crm-region-cascader-country-label' }, [
    h('span', { class: 'crm-region-cascader-country-label__flag' }, regionOption.flag),
    h('span', { class: 'crm-region-cascader-country-label__text' }, label)
  ]);
}
</script>

<template>
  <NCascader
    :value="cascaderValue"
    clearable
    :disabled="cascaderDisabled"
    expand-trigger="hover"
    filterable
    :filter-menu-props="filterDropdownMenuProps"
    :filter="filterCrmRegionOption"
    :get-column-style="getRegionColumnStyle"
    :menu-props="dropdownMenuProps"
    :options="regionOptions"
    :placeholder="placeholder"
    :render-label="renderRegionLabel"
    show-path
    @update:show="handleRegionDropdownShow"
    @update:value="handleRegionUpdate"
  />
</template>

<style scoped>
:global(.crm-region-cascader-country-label) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  vertical-align: middle;
  white-space: nowrap;
}

:global(.crm-region-cascader-country-label__flag) {
  flex: 0 0 auto;
  width: 20px;
  font-size: 16px;
  line-height: 1;
  text-align: center;
}

:global(.crm-region-cascader-country-label__text) {
  overflow: visible;
  text-overflow: clip;
}

:global(.crm-region-cascader-menu .n-cascader-submenu) {
  width: max-content;
}

:global(.crm-region-cascader-menu .n-cascader-option) {
  width: max-content;
  min-width: 100%;
}

:global(.crm-region-cascader-menu .n-cascader-option__label) {
  flex: 0 0 auto;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
</style>
