<script setup lang="tsx">
import { ref, shallowRef } from 'vue';
import { NButton, NPopconfirm, NSpace, NTag, NText } from 'naive-ui';
import {
  createSystemUser,
  fetchSystemUsers,
  resetSystemUserPassword,
  updateSystemUser,
  updateSystemUserStatus
} from '@/service/api';
import { useAppStore } from '@/store/modules/app';
import { defaultTransform, useNaivePaginatedTable } from '@/hooks/common/table';
import TemporaryPasswordModal from './modules/TemporaryPasswordModal.vue';
import UserOperateDrawer from './modules/UserOperateDrawer.vue';
import UserSearch from './modules/UserSearch.vue';
import {
  buildSystemUserSearchParams,
  createDefaultUserFilterModel,
  formatUserDate,
  formatUserDateTime,
  getUserExpirationState,
  getUserLockedState,
  userRoleLabelMap,
  userStatusLabelMap,
  userStatusTagTypeMap
} from './modules/shared';

type OperateType = 'add' | 'edit';

const appStore = useAppStore();

const filterModel = ref(createDefaultUserFilterModel());
const searchParams = ref<Api.SystemUser.UserSearchParams>({
  current: 1,
  size: 10
});
const drawerVisible = shallowRef(false);
const operateType = shallowRef<OperateType>('add');
const editingData = shallowRef<Api.SystemUser.UserListItem | null>(null);
const submitting = shallowRef(false);
const statusOperatingId = shallowRef<string | null>(null);
const resetOperatingId = shallowRef<string | null>(null);
const temporaryPasswordVisible = shallowRef(false);
const temporaryPasswordInfo = shallowRef<{ userName: string; password: string } | null>(null);

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
      minWidth: 150,
      render: row => (
        <div class="user-identity">
          <NText strong>{row.userName}</NText>
          <NText depth={3}>{`ID: ${row.id}`}</NText>
        </div>
      )
    },
    {
      key: 'nickName',
      title: '昵称',
      minWidth: 120,
      render: row => row.nickName || '-'
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
      key: 'status',
      title: '启用状态',
      align: 'center',
      width: 100,
      render: row => (
        <NTag type={userStatusTagTypeMap[row.status]} bordered={false}>
          {userStatusLabelMap[row.status]}
        </NTag>
      )
    },
    {
      key: 'expireAt',
      title: '过期状态',
      minWidth: 140,
      render: row => {
        const state = getUserExpirationState(row);

        return (
          <div class="state-cell">
            <NTag type={state.type} bordered={false}>
              {state.label}
            </NTag>
            <NText depth={3}>{formatUserDate(row.expireAt)}</NText>
          </div>
        );
      }
    },
    {
      key: 'locked',
      title: '锁定状态',
      minWidth: 140,
      render: row => {
        const state = getUserLockedState(row);

        return (
          <div class="state-cell">
            <NTag type={state.type} bordered={false}>
              {state.label}
            </NTag>
            <NText depth={3}>{formatUserDateTime(row.lockedUntil)}</NText>
          </div>
        );
      }
    },
    {
      key: 'companyName',
      title: '公司',
      minWidth: 160,
      ellipsis: {
        tooltip: true
      },
      render: row => row.companyName || '-'
    },
    {
      key: 'lastLoginAt',
      title: '最后登录',
      minWidth: 180,
      render: row => (
        <div class="state-cell">
          <NText>{formatUserDateTime(row.lastLoginAt)}</NText>
          <NText depth={3}>{row.lastLoginIp || '-'}</NText>
        </div>
      )
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 250,
      render: row => {
        const nextStatus: Api.SystemUser.UserStatus = row.status === 'enabled' ? 'disabled' : 'enabled';
        const statusText = nextStatus === 'enabled' ? '启用' : '禁用';

        return (
          <NSpace justify="center" size={8}>
            <NButton size="small" quaternary type="primary" onClick={() => handleEdit(row)}>
              编辑
            </NButton>
            <NPopconfirm onPositiveClick={() => handleUpdateStatus(row, nextStatus)}>
              {{
                default: () => `确认${statusText}用户“${row.userName}”？`,
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
            <NPopconfirm onPositiveClick={() => handleResetPassword(row)}>
              {{
                default: () => `确认重置用户“${row.userName}”的密码？`,
                trigger: () => (
                  <NButton size="small" quaternary type="warning" loading={resetOperatingId.value === row.id}>
                    重置密码
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

function handleEdit(row: Api.SystemUser.UserListItem) {
  operateType.value = 'edit';
  editingData.value = row;
  drawerVisible.value = true;
}

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

async function handleSubmit(payload: Api.SystemUser.UserCreatePayload | Api.SystemUser.UserUpdatePayload) {
  submitting.value = true;

  try {
    if (operateType.value === 'add') {
      const { data: result, error } = await createSystemUser(payload as Api.SystemUser.UserCreatePayload);

      if (error) {
        return;
      }

      window.$message?.success('用户创建成功');
      showTemporaryPassword(result);
    } else if (editingData.value) {
      const { error } = await updateSystemUser(editingData.value.id, payload);

      if (error) {
        return;
      }

      window.$message?.success('用户更新成功');
    }

    drawerVisible.value = false;
    await getData();
  } finally {
    submitting.value = false;
  }
}

async function handleUpdateStatus(row: Api.SystemUser.UserListItem, status: Api.SystemUser.UserStatus) {
  statusOperatingId.value = row.id;

  try {
    const { error } = await updateSystemUserStatus(row.id, { status });

    if (error) {
      return;
    }

    window.$message?.success(`用户已${status === 'enabled' ? '启用' : '禁用'}`);
    await getData();
  } finally {
    statusOperatingId.value = null;
  }
}

async function handleResetPassword(row: Api.SystemUser.UserListItem) {
  resetOperatingId.value = row.id;

  try {
    const { data: result, error } = await resetSystemUserPassword(row.id);

    if (error) {
      return;
    }

    window.$message?.success('密码已重置');
    showTemporaryPassword(result);
    await getData();
  } finally {
    resetOperatingId.value = null;
  }
}

/** Show the one-time password returned by create and reset-password APIs. */
function showTemporaryPassword(result: Api.SystemUser.UserWithTemporaryPassword) {
  temporaryPasswordInfo.value = {
    userName: result.user.userName,
    password: result.temporaryPassword
  };
  temporaryPasswordVisible.value = true;
}

function clearTemporaryPassword() {
  temporaryPasswordInfo.value = null;
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <UserSearch v-model="filterModel" :loading="loading" @search="handleSearch" @reset="handleReset" />
    <NCard title="用户管理" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
        :scroll-x="1450"
        :loading="loading"
        remote
        :row-key="row => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
    </NCard>

    <UserOperateDrawer
      v-model:show="drawerVisible"
      :operate-type="operateType"
      :row="editingData"
      :loading="submitting"
      @submit="handleSubmit"
    />
    <TemporaryPasswordModal
      v-if="temporaryPasswordInfo"
      v-model:show="temporaryPasswordVisible"
      :user-name="temporaryPasswordInfo.userName"
      :password="temporaryPasswordInfo.password"
      @clear="clearTemporaryPassword"
    />
  </div>
</template>

<style scoped>
.user-identity,
.state-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
