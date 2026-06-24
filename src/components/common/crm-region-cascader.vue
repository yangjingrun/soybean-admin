<script setup lang="ts">
import { computed } from 'vue';
import { useCrmRegionCascader } from '@/hooks/business/crm-region-cascader';

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

function handleRegionUpdate(value: string | number | null) {
  emit('update:modelValue', typeof value === 'string' ? value : '');
  clearRegionSearch();
}
</script>

<template>
  <NCascader
    :value="cascaderValue"
    cascade
    check-strategy="child"
    clearable
    :disabled="cascaderDisabled"
    expand-trigger="hover"
    filterable
    :filter="filterCrmRegionOption"
    :options="regionOptions"
    :placeholder="placeholder"
    show-path
    @update:show="handleRegionDropdownShow"
    @update:value="handleRegionUpdate"
  />
</template>
