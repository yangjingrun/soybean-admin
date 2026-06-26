<script setup lang="tsx">
import { computed } from 'vue';
import type { PaginationProps } from 'naive-ui';
import { NButton, NTag, NText } from 'naive-ui';
import { roleStatusLabelMap, roleStatusTagTypeMap } from './shared';

const props = defineProps<{
  loading?: boolean;
  manageable?: boolean;
  pagination: PaginationProps;
  records: Api.SystemRole.RoleListItem[];
  selectedRoleId: string | null;
}>();

const emit = defineEmits<{
  add: [];
  edit: [role: Api.SystemRole.RoleListItem];
  refresh: [];
  select: [role: Api.SystemRole.RoleListItem];
}>();

const columns = computed<NaiveUI.TableColumn<Api.SystemRole.RoleListItem>[]>(() => [
  {
    key: 'roleName',
    title: '角色',
    minWidth: 180,
    render: row => (
      <div class="role-cell">
        <NText strong>{row.roleName}</NText>
        <NText depth={3}>{row.roleCode}</NText>
      </div>
    )
  },
  {
    key: 'permissions',
    title: '权限数',
    align: 'center',
    width: 90,
    render: row => (row.roleCode === 'R_SUPER' ? '全部' : row.permissions.length)
  },
  {
    key: 'status',
    title: '状态',
    align: 'center',
    width: 90,
    render: row => (
      <NTag size="small" type={roleStatusTagTypeMap[row.status]} bordered={false}>
        {roleStatusLabelMap[row.status]}
      </NTag>
    )
  },
  {
    key: 'builtIn',
    title: '类型',
    align: 'center',
    width: 90,
    render: row => (row.builtIn ? <NTag size="small" type="info">内置</NTag> : <NTag size="small">自定义</NTag>)
  },
  {
    key: 'operate',
    title: '操作',
    align: 'center',
    width: props.manageable === false ? 90 : 150,
    render: row => (
      <div class="role-actions">
        <NButton size="small" quaternary type={row.id === props.selectedRoleId ? 'primary' : 'default'} onClick={() => emit('select', row)}>
          权限
        </NButton>
        {props.manageable !== false ? (
          <NButton size="small" quaternary type="primary" onClick={() => emit('edit', row)}>
            编辑
          </NButton>
        ) : null}
      </div>
    )
  }
]);

function getRowClassName(row: Api.SystemRole.RoleListItem) {
  return row.id === props.selectedRoleId ? 'role-row is-selected' : 'role-row';
}

function getRowProps(row: Api.SystemRole.RoleListItem) {
  return {
    onClick: () => emit('select', row)
  };
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper role-table-card" title="角色列表">
    <template #header-extra>
      <NSpace :size="8">
        <NButton v-if="manageable !== false" size="small" type="primary" @click="emit('add')">新增角色</NButton>
        <NButton size="small" :loading="loading" @click="emit('refresh')">刷新</NButton>
      </NSpace>
    </template>
    <NDataTable
      :columns="columns"
      :data="records"
      size="small"
      :loading="loading"
      :pagination="pagination"
      :row-key="row => row.id"
      :row-class-name="getRowClassName"
      :row-props="getRowProps"
      :scroll-x="600"
      remote
    />
  </NCard>
</template>

<style scoped>
.role-table-card {
  min-height: 100%;
}

.role-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-actions {
  display: flex;
  justify-content: center;
  gap: 6px;
}

:deep(.role-row) {
  cursor: pointer;
}

:deep(.role-row.is-selected td) {
  background: var(--n-td-color-hover);
}
</style>
