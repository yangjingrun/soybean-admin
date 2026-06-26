<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import type { PaginationProps } from 'naive-ui';
import { fetchSystemRoles, updateSystemRolePermissions } from '@/service/api/system-role';
import RolePermissionPanel from '../role/modules/RolePermissionPanel.vue';
import RoleTable from '../role/modules/RoleTable.vue';
import { buildSystemRoleSearchParams, createDefaultRoleFilterModel } from '../role/modules/shared';

const filterModel = ref(createDefaultRoleFilterModel());
const records = shallowRef<Api.SystemRole.RoleListItem[]>([]);
const selectedRoleId = shallowRef<string | null>(null);
const draftPermissions = shallowRef<Api.SystemRole.PermissionCode[]>([]);
const loading = shallowRef(false);
const savingRoleId = shallowRef<string | null>(null);
let requestId = 0;

const selectedRole = computed(() => records.value.find(role => role.id === selectedRoleId.value) || null);
const savingPermissions = computed(() => Boolean(savingRoleId.value));

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

/** Load roles and keep only the latest response bound to the permission workspace. */
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

async function handleSavePermissions(role: Api.SystemRole.RoleListItem, permissions: Api.SystemRole.PermissionCode[]) {
  savingRoleId.value = role.id;

  try {
    const { data, error } = await updateSystemRolePermissions(role.id, { permissions });

    if (error) {
      return;
    }

    records.value = records.value.map(item => (item.id === data.id ? data : item));

    if (selectedRoleId.value === data.id) {
      draftPermissions.value = [...data.permissions];
    }

    window.$message?.success('角色权限已保存');
  } finally {
    if (savingRoleId.value === role.id) {
      savingRoleId.value = null;
    }
  }
}

onMounted(fetchRoles);
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <div class="permission-layout">
      <RoleTable
        :records="records"
        :selected-role-id="selectedRoleId"
        :loading="loading"
        :pagination="pagination"
        :manageable="false"
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
  </div>
</template>

<style scoped>
.permission-layout {
  display: grid;
  grid-template-columns: minmax(360px, 45%) minmax(0, 1fr);
  gap: 16px;
  min-height: 520px;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .permission-layout {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }
}
</style>
