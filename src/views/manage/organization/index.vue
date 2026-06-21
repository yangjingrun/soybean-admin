<script setup lang="tsx">
import { ref, shallowRef } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag, NText } from 'naive-ui';
import {
  createSystemOrganization,
  fetchSystemOrganizations,
  updateSystemOrganization,
  updateSystemOrganizationStatus
} from '@/service/api/system-organization';
import { useAppStore } from '@/store/modules/app';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import OrganizationOperateDrawer from './modules/OrganizationOperateDrawer.vue';
import OrganizationSearch from './modules/OrganizationSearch.vue';
import {
  buildSystemOrganizationSearchParams,
  createDefaultOrganizationFilterModel,
  formatOrganizationDateTime,
  organizationStatusLabelMap,
  organizationStatusTagTypeMap
} from './modules/shared';

type OperateType = 'add' | 'edit';

const appStore = useAppStore();

const filterModel = ref(createDefaultOrganizationFilterModel());
const searchParams = ref<Api.SystemOrganization.OrganizationSearchParams>({
  current: 1,
  size: 10
});
const drawerVisible = shallowRef(false);
const operateType = shallowRef<OperateType>('add');
const editingData = shallowRef<Api.SystemOrganization.OrganizationListItem | null>(null);
const submitting = shallowRef(false);
const statusOperatingId = shallowRef<string | null>(null);

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination } = useNaivePaginatedTable({
  api: () => fetchSystemOrganizations(searchParams.value),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => {
    searchParams.value = buildSystemOrganizationSearchParams({
      current: params.page || 1,
      size: params.pageSize || 10,
      filterModel: filterModel.value
    });
  },
  columns: () => [
    {
      key: 'index',
      title: '序号',
      align: 'center',
      width: 64,
      render: (_, index) => index + 1
    },
    {
      key: 'name',
      title: '组织名称/ID',
      minWidth: 220,
      render: row => (
        <div class="organization-identity">
          <NText strong>{row.name}</NText>
          <NText depth={3}>{`ID: ${row.id}`}</NText>
        </div>
      )
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: row => (
        <NTag type={organizationStatusTagTypeMap[row.status]} bordered={false}>
          {organizationStatusLabelMap[row.status]}
        </NTag>
      )
    },
    {
      key: 'userCount',
      title: '用户数',
      align: 'center',
      width: 100
    },
    {
      key: 'adminCount',
      title: '管理员数',
      align: 'center',
      width: 110
    },
    {
      key: 'createdAt',
      title: '创建时间',
      minWidth: 180,
      render: row => formatOrganizationDateTime(row.createdAt)
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      minWidth: 180,
      render: row => formatOrganizationDateTime(row.updatedAt)
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 160,
      render: row => {
        const nextStatus: Api.SystemOrganization.OrganizationStatus = row.status === 'enabled' ? 'disabled' : 'enabled';
        const statusText = nextStatus === 'enabled' ? '启用' : '禁用';

        return (
          <NSpace justify="center" size={8}>
            <NButton size="small" quaternary type="primary" onClick={() => handleEdit(row)}>
              编辑
            </NButton>
            <NPopconfirm onPositiveClick={() => handleUpdateStatus(row, nextStatus)}>
              {{
                default: () => `确认${statusText}组织“${row.name}”？`,
                trigger: () => (
                  <NButton
                    size="small"
                    quaternary
                    type={nextStatus === 'disabled' ? 'error' : 'success'}
                    loading={statusOperatingId.value === row.id}
                  >
                    {statusText}
                  </NButton>
                )
              }}
            </NPopconfirm>
          </NSpace>
        );
      }
    }
  ]
});

function handleAdd() {
  operateType.value = 'add';
  editingData.value = null;
  drawerVisible.value = true;
}

function handleEdit(row: Api.SystemOrganization.OrganizationListItem) {
  operateType.value = 'edit';
  editingData.value = row;
  drawerVisible.value = true;
}

async function handleSearch() {
  searchParams.value = buildSystemOrganizationSearchParams({
    current: 1,
    size: searchParams.value.size,
    filterModel: filterModel.value
  });

  await getDataByPage();
}

async function handleReset() {
  filterModel.value = createDefaultOrganizationFilterModel();
  await handleSearch();
}

async function handleSubmit(payload: Api.SystemOrganization.OrganizationOperatePayload) {
  submitting.value = true;

  try {
    if (operateType.value === 'add') {
      const { error } = await createSystemOrganization(payload);

      if (error) {
        return;
      }

      window.$message?.success('组织创建成功');
    } else if (editingData.value) {
      const { error } = await updateSystemOrganization(editingData.value.id, payload);

      if (error) {
        return;
      }

      window.$message?.success('组织更新成功');
    }

    drawerVisible.value = false;
    await getData();
  } finally {
    submitting.value = false;
  }
}

async function handleUpdateStatus(
  row: Api.SystemOrganization.OrganizationListItem,
  status: Api.SystemOrganization.OrganizationStatus
) {
  statusOperatingId.value = row.id;

  try {
    const { error } = await updateSystemOrganizationStatus(row.id, { status });

    if (error) {
      return;
    }

    window.$message?.success(`组织已${status === 'enabled' ? '启用' : '禁用'}`);
    await getData();
  } finally {
    statusOperatingId.value = null;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <OrganizationSearch v-model="filterModel" :loading="loading" @search="handleSearch" @reset="handleReset" />
    <NCard title="组织管理" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace :size="8">
          <NButton size="small" type="primary" @click="handleAdd">新增</NButton>
          <TableColumnSetting v-model:columns="columnChecks" />
          <NButton size="small" :loading="loading" @click="getData">刷新</NButton>
        </NSpace>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="1120"
        :loading="loading"
        remote
        :row-key="row => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>

    <OrganizationOperateDrawer
      v-model:show="drawerVisible"
      :operate-type="operateType"
      :row="editingData"
      :loading="submitting"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.organization-identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
