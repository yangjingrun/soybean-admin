<script setup lang="ts">
import { computed, h, shallowRef, type CSSProperties, type VNodeChild } from 'vue';
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
const cascaderShow = shallowRef(false);
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

function handleRegionShowUpdate(show: boolean) {
  cascaderShow.value = show;
  handleRegionDropdownShow(show);
}

function handleRegionLabelClick(event: MouseEvent, option: CrmRegionCascaderOption) {
  if (option.nodeType !== 'country') {
    return;
  }

  event.stopPropagation();
  handleRegionUpdate(option.value);
  cascaderShow.value = false;
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

  if (regionOption.nodeType !== 'country') {
    return label;
  }

  return h(
    'span',
    {
      class: 'crm-region-cascader-country-label',
      onClick: (event: MouseEvent) => handleRegionLabelClick(event, regionOption)
    },
    [
      h('span', { class: 'crm-region-cascader-country-label__flag' }, regionOption.flag ?? ''),
      h('span', { class: 'crm-region-cascader-country-label__text' }, label)
    ]
  );
}

function renderEmptyRegionPrefix() {
  return null;
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
    :cascade="false"
    :multiple="false"
    :options="regionOptions"
    :placeholder="placeholder"
    :render-label="renderRegionLabel"
    :render-prefix="renderEmptyRegionPrefix"
    show-path
    :show="cascaderShow"
    @update:show="handleRegionShowUpdate"
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
  padding-left: 8px;
}

:global(.crm-region-cascader-menu .n-cascader-option--show-prefix) {
  padding-left: 8px;
}

:global(.crm-region-cascader-menu .n-cascader-option__prefix) {
  display: none;
}

:global(.crm-region-cascader-menu .n-cascader-option .n-checkbox) {
  display: none;
}

:global(.crm-region-cascader-menu .n-cascader-option__label) {
  flex: 0 0 auto;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
</style>
