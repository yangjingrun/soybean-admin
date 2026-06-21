<script setup lang="ts">
import type { PermissionGroup } from './shared';

defineProps<{
  disabled?: boolean;
  group: PermissionGroup;
  selected: Api.SystemRole.PermissionCode[];
}>();

const emit = defineEmits<{
  clearGroup: [group: PermissionGroup];
  selectGroup: [group: PermissionGroup];
  toggle: [code: Api.SystemRole.PermissionCode, checked: boolean];
}>();
</script>

<template>
  <div class="permission-group">
    <div class="permission-group__header">
      <NText strong>{{ group.label }}</NText>
      <NSpace :size="6">
        <NButton size="tiny" quaternary :disabled="disabled" @click="emit('selectGroup', group)">全选</NButton>
        <NButton size="tiny" quaternary :disabled="disabled" @click="emit('clearGroup', group)">清空</NButton>
      </NSpace>
    </div>
    <NSpace :size="[16, 8]" wrap>
      <NCheckbox
        v-for="option in group.options"
        :key="option.value"
        :checked="selected.includes(option.value)"
        :disabled="disabled"
        @update:checked="checked => emit('toggle', option.value, checked)"
      >
        {{ option.label }}
      </NCheckbox>
    </NSpace>
  </div>
</template>

<style scoped>
.permission-group {
  border-bottom: 1px solid var(--n-border-color);
  padding-bottom: 14px;
}

.permission-group:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.permission-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
</style>
