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
      <NSpace :size="4" class="permission-group__actions">
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
          <span class="permission-option__topline">
            <span class="permission-option__label">{{ option.label }}</span>
            <NTooltip trigger="hover">
              <template #trigger>
                <NTag size="tiny" :bordered="false" class="permission-option__code">权限码</NTag>
              </template>
              {{ option.value }}
            </NTooltip>
          </span>
          <span class="permission-option__desc">{{ option.description }}</span>
        </span>
      </NCheckbox>
    </div>
  </div>
</template>

<style scoped>
.permission-group {
  padding: 14px 0;
  border-top: 1px solid var(--n-border-color);
}

.permission-group:first-child {
  padding-top: 0;
  border-top: 0;
}

.permission-group:last-child {
  padding-bottom: 0;
}

.permission-group__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
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
  line-height: 1.55;
}

.permission-group__actions {
  flex-shrink: 0;
}

.permission-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.permission-option {
  align-items: flex-start;
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  transition:
    border-color 0.2s var(--n-bezier),
    background-color 0.2s var(--n-bezier);
}

.permission-option:hover {
  border-color: var(--n-primary-color-hover);
  background: var(--n-color-embedded);
}

.permission-option :deep(.n-checkbox__label) {
  flex: 1;
  min-width: 0;
}

.permission-option__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.permission-option__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.permission-option__label {
  overflow: hidden;
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-option__code {
  flex-shrink: 0;
  color: var(--n-text-color-3);
}

.permission-option__desc {
  margin-top: 4px;
  color: var(--n-text-color-3);
}
</style>
