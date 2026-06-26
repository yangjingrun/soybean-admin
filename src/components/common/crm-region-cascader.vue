<script setup lang="ts">
import { computed, h, shallowRef, type CSSProperties, type VNodeChild } from 'vue';
import type { CascaderOption } from 'naive-ui';
import { useCrmRegionCascader } from '@/hooks/business/crm-region-cascader';
import type { CrmRegionCascaderOption } from '@/utils/crm-region-cascader';

defineOptions({ name: 'CrmRegionCascader' });

type RegionCascaderValue = string | string[];

const props = withDefaults(
  defineProps<{
    modelValue?: RegionCascaderValue | null;
    disabled?: boolean;
    multiple?: boolean;
    placeholder?: string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    multiple: false,
    placeholder: '国家 / 省州'
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: RegionCascaderValue];
  'update:selectedPath': [path: CrmRegionCascaderOption[]];
  'update:selectedPaths': [paths: CrmRegionCascaderOption[][]];
}>();

const { clearRegionSearch, filterCrmRegionOption, handleRegionDropdownShow, regionLoading, regionOptions } =
  useCrmRegionCascader();

const cascaderValue = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue : [];
  }

  return typeof props.modelValue === 'string' && props.modelValue ? props.modelValue : null;
});
const cascaderDisabled = computed(() => props.disabled || regionLoading.value);
const cascaderShow = shallowRef(false);
const dropdownStyle = {
  // 国家-省州列表较长，放大弹层高度减少滚动成本。
  '--n-menu-height': 'min(72vh, 560px)'
} as CSSProperties;
const menuClass = computed(() => [
  'crm-region-cascader-menu',
  props.multiple ? 'crm-region-cascader-menu--multiple' : 'crm-region-cascader-menu--single'
]);
const dropdownMenuProps = computed(() => ({
  class: menuClass.value,
  style: dropdownStyle
}));
const filterDropdownMenuProps = computed(() => ({
  class: menuClass.value,
  style: dropdownStyle
}));

function handleRegionUpdate(
  value: string | number | Array<string | number> | null,
  _option?: CascaderOption | null | Array<CascaderOption | null>,
  path?: CascaderOption[] | null | Array<CascaderOption[] | null>
) {
  const paths = normalizeSelectedRegionPaths(path);
  const selectedValue = normalizeRegionValue(value);

  emit('update:modelValue', selectedValue);
  emit('update:selectedPath', paths[0] ?? []);
  emit('update:selectedPaths', paths);
  clearRegionSearch();
}

function handleRegionShowUpdate(show: boolean) {
  cascaderShow.value = show;
  handleRegionDropdownShow(show);
}

function handleRegionLabelClick(event: MouseEvent, option: CrmRegionCascaderOption) {
  if (props.multiple || option.nodeType !== 'country') {
    return;
  }

  event.stopPropagation();
  handleRegionUpdate(option.value, option, [option]);
  cascaderShow.value = false;
}

/** Naive UI 在单选和多选下 path 形态不同，这里统一成路径数组。 */
function normalizeSelectedRegionPaths(path?: CascaderOption[] | null | Array<CascaderOption[] | null>) {
  if (!path) {
    return [];
  }

  if (path.length > 0 && Array.isArray(path[0])) {
    return (path as Array<CascaderOption[] | null>)
      .filter((item): item is CascaderOption[] => Boolean(item))
      .map(item => item as CrmRegionCascaderOption[]);
  }

  return [path as CrmRegionCascaderOption[]];
}

function normalizeRegionValue(value: string | number | Array<string | number> | null): RegionCascaderValue {
  if (props.multiple) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  return typeof value === 'string' ? value : '';
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
    :multiple="multiple"
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

:global(.crm-region-cascader-menu .n-base-select-menu .n-scrollbar) {
  max-height: var(--n-menu-height);
}

:global(.crm-region-cascader-menu .n-base-select-menu-option-wrapper) {
  max-height: var(--n-menu-height);
}

:global(.crm-region-cascader-menu .n-cascader-option) {
  width: max-content;
  min-width: 100%;
  padding-left: 8px;
}

:global(.crm-region-cascader-menu .n-cascader-option--show-prefix) {
  padding-left: 8px;
}

:global(.crm-region-cascader-menu--single .n-cascader-option__prefix) {
  display: none;
}

:global(.crm-region-cascader-menu--single .n-cascader-option .n-checkbox) {
  display: none;
}

:global(.crm-region-cascader-menu .n-cascader-option__label) {
  flex: 0 0 auto;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
</style>
