<script setup lang="tsx">
import { ref } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { fetchSystemUsers } from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import UserSearch from './modules/UserSearch.vue';
import {
  buildSystemUserSearchParams,
  createDefaultUserFilterModel,
  userRoleLabelMap,
  userStatusLabelMap,
  userStatusTagTypeMap
} from './modules/shared';

const appStore = useAppStore();

const filterModel = ref(createDefaultUserFilterModel());
const searchParams = ref<Api.SystemUser.UserSearchParams>({
  current: 1,
  size: 10
});

const { columns, columnChecks, data, getData, getDataByPage, loading, mobilePagination } = useNaivePaginatedTable({
    api: () => fetchSystemUsers(searchParams.value),
    transform: response => defaultTransform(response),
    onPaginationParamsChange: params => {
      searchParams.value = buildSystemUserSearchParams({
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
        key: 'userName',
        title: '用户名',
        align: 'center',
        minWidth: 120
      },
      {
        key: 'userId',
        title: '用户ID',
        align: 'center',
        width: 100
      },
      {
        key: 'roles',
        title: '角色',
        minWidth: 220,
        render: row => (
          <div class="role-tags">
            {row.roles.map(role => (
              <NTag key={role} size="small" type={role === 'R_SUPER' ? 'primary' : 'default'} bordered={false}>
                {userRoleLabelMap.get(role) || role}
              </NTag>
            ))}
          </div>
        )
      },
      {
        key: 'buttons',
        title: '按钮权限',
        minWidth: 180,
        ellipsis: {
          tooltip: true
        },
        render: row => row.buttons.join('、') || '-'
      },
      {
        key: 'status',
        title: '状态',
        align: 'center',
        width: 90,
        render: row => (
          <NTag type={userStatusTagTypeMap[row.status]} bordered={false}>
            {userStatusLabelMap[row.status]}
          </NTag>
        )
      }
    ]
});

async function handleSearch() {
  searchParams.value = buildSystemUserSearchParams({
    current: 1,
    size: searchParams.value.size,
    filterModel: filterModel.value
  });

  await getDataByPage();
}

async function handleReset() {
  filterModel.value = createDefaultUserFilterModel();
  await handleSearch();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <UserSearch v-model="filterModel" :loading="loading" @search="handleSearch" @reset="handleReset" />
    <NCard title="用户管理" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NSpace :size="8">
          <TableColumnSetting v-model:columns="columnChecks" />
          <NButton size="small" :loading="loading" @click="getData">
            刷新
          </NButton>
        </NSpace>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        size="small"
        :flex-height="!appStore.isMobile"
        :scroll-x="774"
        :loading="loading"
        remote
        :row-key="row => row.userId"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>
  </div>
</template>

<style scoped>
.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
