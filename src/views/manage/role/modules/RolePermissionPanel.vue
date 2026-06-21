<script setup lang="ts">
import { computed, watch } from 'vue';
import { crmPermissionCodes } from '@soybean/shared';
import RolePermissionGroup from './RolePermissionGroup.vue';
import {
  buildRolePermissionChangePreview,
  normalizeRolePermissionSelection,
  rolePermissionModules,
  roleStatusLabelMap,
  type PermissionGroup
} from './shared';

const props = defineProps<{
  role: Api.SystemRole.RoleListItem | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [role: Api.SystemRole.RoleListItem, permissions: Api.SystemRole.PermissionCode[]];
}>();

const draftPermissions = defineModel<Api.SystemRole.PermissionCode[]>('draftPermissions', { required: true });

const isSuperRole = computed(() => props.role?.roleCode === 'R_SUPER');
const displayPermissions = computed(() => (isSuperRole.value ? [...crmPermissionCodes] : draftPermissions.value));
const preview = computed(() => buildRolePermissionChangePreview(props.role?.permissions || [], draftPermissions.value));
const canSave = computed(() => Boolean(props.role && !isSuperRole.value && preview.value.changed));

watch(
  () => props.role?.id,
  () => {
    draftPermissions.value = props.role ? [...props.role.permissions] : [];
  }
);

/** Toggle one permission while keeping implied read permissions normalized. */
function handleToggle(code: Api.SystemRole.PermissionCode, checked: boolean) {
  const next = new Set(draftPermissions.value);

  if (checked) {
    next.add(code);
  } else {
    next.delete(code);
  }

  draftPermissions.value = normalizeRolePermissionSelection([...next]);
}

/** Add every permission in one group. */
function handleSelectGroup(group: PermissionGroup) {
  const next = new Set(draftPermissions.value);

  group.options.forEach(option => next.add(option.value));
  draftPermissions.value = normalizeRolePermissionSelection([...next]);
}

/** Remove every permission in one group. */
function handleClearGroup(group: PermissionGroup) {
  const groupValues = new Set(group.options.map(option => option.value));
  const next = draftPermissions.value.filter(code => !groupValues.has(code));

  draftPermissions.value = normalizeRolePermissionSelection(next);
}

function handleReset() {
  draftPermissions.value = props.role ? [...props.role.permissions] : [];
}

function handleSave() {
  if (!props.role) {
    return;
  }

  emit('save', props.role, [...draftPermissions.value]);
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper permission-panel" title="角色权限">
    <NEmpty v-if="!role" description="请选择一个角色" class="permission-empty" />
    <NSpace v-else vertical :size="14">
      <div class="role-summary">
        <div class="role-summary__main">
          <NText strong>{{ role.roleName }}</NText>
          <NText depth="3">{{ role.roleCode }}</NText>
        </div>
        <NSpace :size="[6, 6]" wrap>
          <NTag size="small" :type="role.status === 'enabled' ? 'success' : 'error'">
            {{ roleStatusLabelMap[role.status] }}
          </NTag>
          <NTag v-if="role.builtIn" size="small" type="info">内置角色</NTag>
        </NSpace>
      </div>

      <NAlert v-if="isSuperRole" type="info" :bordered="false">
        超级管理员角色默认拥有全部权限，系统不允许裁剪该角色权限。
      </NAlert>

      <NSpace vertical :size="14" class="permission-modules">
        <section v-for="module in rolePermissionModules" :key="module.key" class="permission-module">
          <div class="permission-module__title">
            <NText strong>{{ module.label }}</NText>
          </div>
          <div v-for="page in module.pages" :key="page.key" class="permission-page">
            <div class="permission-page__header">
              <NTag size="small" type="info" :bordered="false">{{ page.label }}</NTag>
            </div>
            <NSpace vertical :size="10">
              <RolePermissionGroup
                v-for="group in page.groups"
                :key="group.key"
                :group="group"
                :selected="displayPermissions"
                :disabled="isSuperRole || saving"
                @toggle="handleToggle"
                @select-group="handleSelectGroup"
                @clear-group="handleClearGroup"
              />
            </NSpace>
          </div>
        </section>
      </NSpace>

      <NAlert v-if="!isSuperRole && !preview.changed" type="success" :bordered="false" title="权限未变更">
        当前草稿与角色已保存权限一致。
      </NAlert>
      <NAlert v-else-if="!isSuperRole" type="warning" :bordered="false" title="保存后将更新角色权限">
        <NSpace vertical :size="8">
          <div class="change-row">
            <NText depth="3">新增</NText>
            <NSpace v-if="preview.addedLabels.length" :size="[6, 6]" wrap>
              <NTag v-for="label in preview.addedLabels" :key="label" size="small" type="success" bordered>
                {{ label }}
              </NTag>
            </NSpace>
            <NText v-else depth="3">无</NText>
          </div>
          <div class="change-row">
            <NText depth="3">移除</NText>
            <NSpace v-if="preview.removedLabels.length" :size="[6, 6]" wrap>
              <NTag v-for="label in preview.removedLabels" :key="label" size="small" type="error" bordered>
                {{ label }}
              </NTag>
            </NSpace>
            <NText v-else depth="3">无</NText>
          </div>
        </NSpace>
      </NAlert>

      <div class="permission-actions">
        <NSpace justify="end" :size="8">
          <NButton size="small" :disabled="isSuperRole || saving || !preview.changed" @click="handleReset">
            撤销修改
          </NButton>
          <NButton size="small" type="primary" :disabled="!canSave" :loading="saving" @click="handleSave">
            保存权限
          </NButton>
        </NSpace>
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
.permission-panel {
  min-height: 100%;
}

.permission-empty {
  min-height: 320px;
}

.role-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.role-summary__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.change-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.permission-actions {
  display: flex;
  justify-content: flex-end;
}

.permission-modules {
  min-width: 0;
}

.permission-module {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
}

.permission-module__title {
  margin-bottom: 10px;
}

.permission-page {
  padding: 10px 0;
  border-top: 1px dashed var(--n-border-color);
}

.permission-page__header {
  display: flex;
  margin-bottom: 10px;
}
</style>
