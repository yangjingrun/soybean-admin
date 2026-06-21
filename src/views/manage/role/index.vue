<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import type { PaginationProps } from 'naive-ui';
import { createSystemRole, fetchSystemRoles, updateSystemRole, updateSystemRolePermissions } from '@/service/api';
import RoleOperateDrawer from './modules/RoleOperateDrawer.vue';
import RolePermissionPanel from './modules/RolePermissionPanel.vue';
import RoleSearch from './modules/RoleSearch.vue';
import RoleTable from './modules/RoleTable.vue';
import { buildSystemRoleSearchParams, createDefaultRoleFilterModel } from './modules/shared';

type OperateType = 'add' | 'edit';

const filterModel = ref(createDefaultRoleFilterModel());
const records = shallowRef<Api.SystemRole.RoleListItem[]>([]);
const selectedRoleId = shallowRef<string | null>(null);
const editingRole = shallowRef<Api.SystemRole.RoleListItem | null>(null);
const drawerVisible = shallowRef(false);
const operateType = shallowRef<OperateType>('add');
const draftPermissions = shallowRef<Api.SystemRole.PermissionCode[]>([]);
const loading = shallowRef(false);
const submitting = shallowRef(false);
const savingPermissions = shallowRef(false);
let requestId = 0;

const selectedRole = computed(() => records.value.find(role => role.id === selectedRoleId.value) || null);

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 15, 20, 25, 30],
  onUpdatePage: page => {
    pagination.page = page;
    void fetchRoles();
  },
  onUpdatePageSize: pageSize => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchRoles();
  }
});

/** Load roles with request ordering so stale responses cannot overwrite newer filters. */
async function fetchRoles() {
  const currentRequestId = ++requestId;
  loading.value = true;

  try {
    const { data, error } = await fetchSystemRoles(
      buildSystemRoleSearchParams({
        current: pagination.page || 1,
        size: pagination.pageSize || 10,
        filterModel: filterModel.value
      })
    );

    if (error || currentRequestId !== requestId) {
      return;
    }

    records.value = data.records;
    pagination.itemCount = data.total;
    selectAvailableRole();
  } finally {
    if (currentRequestId === requestId) {
      loading.value = false;
    }
  }
}

function selectAvailableRole() {
  const current = records.value.find(role => role.id === selectedRoleId.value);
  const next = current || records.value[0] || null;

  handleSelectRole(next);
}

function handleSelectRole(role: Api.SystemRole.RoleListItem | null) {
  selectedRoleId.value = role?.id || null;
  draftPermissions.value = role ? [...role.permissions] : [];
}

function handleAdd() {
  operateType.value = 'add';
  editingRole.value = null;
  drawerVisible.value = true;
}

function handleEdit(role: Api.SystemRole.RoleListItem) {
  operateType.value = 'edit';
  editingRole.value = role;
  drawerVisible.value = true;
}

async function handleSubmit(payload: Api.SystemRole.RoleCreatePayload | Api.SystemRole.RoleUpdatePayload) {
  submitting.value = true;

  try {
    if (operateType.value === 'add') {
      const { data, error } = await createSystemRole(payload as Api.SystemRole.RoleCreatePayload);

      if (error) {
        return;
      }

      window.$message?.success('角色创建成功');
      selectedRoleId.value = data.id;
    } else if (editingRole.value) {
      const { data, error } = await updateSystemRole(editingRole.value.id, payload as Api.SystemRole.RoleUpdatePayload);

      if (error) {
        return;
      }

      window.$message?.success('角色更新成功');
      records.value = records.value.map(role => (role.id === data.id ? data : role));
    }

    drawerVisible.value = false;
    await fetchRoles();
  } finally {
    submitting.value = false;
  }
}

async function handleSavePermissions(role: Api.SystemRole.RoleListItem, permissions: Api.SystemRole.PermissionCode[]) {
  savingPermissions.value = true;

  try {
    const { data, error } = await updateSystemRolePermissions(role.id, { permissions });

    if (error) {
      return;
    }

    records.value = records.value.map(item => (item.id === data.id ? data : item));
    draftPermissions.value = [...data.permissions];
    window.$message?.success('角色权限已保存');
  } finally {
    savingPermissions.value = false;
  }
}

async function handleSearch() {
  pagination.page = 1;
  await fetchRoles();
}

async function handleReset() {
  filterModel.value = createDefaultRoleFilterModel();
  await handleSearch();
}

onMounted(fetchRoles);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <RoleSearch v-model="filterModel" :loading="loading" @search="handleSearch" @reset="handleReset" />
    <div class="role-layout">
      <RoleTable
        :records="records"
        :selected-role-id="selectedRoleId"
        :loading="loading"
        :pagination="pagination"
        @add="handleAdd"
        @edit="handleEdit"
        @select="handleSelectRole"
        @refresh="fetchRoles"
      />
      <RolePermissionPanel
        v-model:draft-permissions="draftPermissions"
        :role="selectedRole"
        :saving="savingPermissions"
        @save="handleSavePermissions"
      />
    </div>

    <RoleOperateDrawer
      v-model:show="drawerVisible"
      :operate-type="operateType"
      :row="editingRole"
      :loading="submitting"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.role-layout {
  display: grid;
  grid-template-columns: minmax(360px, 45%) minmax(0, 1fr);
  gap: 16px;
  min-height: 520px;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .role-layout {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }
}
</style>
