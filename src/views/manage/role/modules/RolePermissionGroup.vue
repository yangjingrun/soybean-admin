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
      <div class="permission-group__title">
        <NText strong>{{ group.label }}</NText>
        <NText depth="3" class="permission-group__desc">{{ group.description }}</NText>
      </div>
      <NSpace :size="6">
        <NButton size="tiny" quaternary :disabled="disabled" @click="emit('selectGroup', group)">全选</NButton>
        <NButton size="tiny" quaternary :disabled="disabled" @click="emit('clearGroup', group)">清空</NButton>
      </NSpace>
    </div>
    <div class="permission-options">
      <NCheckbox
        v-for="option in group.options"
        :key="option.value"
        :checked="selected.includes(option.value)"
        :disabled="disabled"
        class="permission-option"
        @update:checked="checked => emit('toggle', option.value, checked)"
      >
        <span class="permission-option__content">
          <span class="permission-option__main">
            <span>{{ option.actionLabel }}</span>
            <NTag size="tiny" :bordered="false">{{ option.value }}</NTag>
          </span>
          <NText depth="3" class="permission-option__desc">{{ option.description }}</NText>
        </span>
      </NCheckbox>
    </div>
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

.permission-group__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.permission-group__desc,
.permission-option__desc {
  font-size: 12px;
  line-height: 1.5;
}

.permission-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 12px;
}

.permission-option {
  align-items: flex-start;
}

.permission-option__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.permission-option__main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
</style>
