<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { fetchEnabledSystemRoles } from '@/service/api/system-role';
import { userExpirationOptions, userRoleOptions, userStatusOptions } from './shared';

const filterModel = defineModel<Api.SystemUser.UserFilterModel>('modelValue', { required: true });

defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const roleOptions = shallowRef<Array<{ label: string; value: Api.SystemUser.UserRole }>>(userRoleOptions);

const keywordValue = computed({
  get: () => filterModel.value.keyword,
  set: value => {
    filterModel.value.keyword = value;
  }
});

const roleValue = computed({
  get: () => filterModel.value.role,
  set: value => {
    filterModel.value.role = value;
  }
});

const statusValue = computed({
  get: () => filterModel.value.status,
  set: value => {
    filterModel.value.status = value;
  }
});

const expirationStatusValue = computed({
  get: () => filterModel.value.expirationStatus,
  set: value => {
    filterModel.value.expirationStatus = value;
  }
});

/** Load enabled roles for user filtering. */
async function loadRoleOptions() {
  const { data, error } = await fetchEnabledSystemRoles();

  if (error) {
    return;
  }

  roleOptions.value = data.map(role => ({
    label: role.roleName,
    value: role.roleCode
  }));
}

onMounted(loadRoleOptions);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small" :show-feedback="false">
        <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="24 m:12 l:8">
            <NFormItem label="关键词">
              <NInput
                v-model:value="keywordValue"
                clearable
                placeholder="用户名 / 昵称 / 手机 / 邮箱"
                @keyup.enter="emit('search')"
              />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 l:6">
            <NFormItem label="角色">
              <NSelect v-model:value="roleValue" :options="roleOptions" clearable placeholder="全部角色" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 l:5">
            <NFormItem label="状态">
              <NSelect v-model:value="statusValue" :options="userStatusOptions" clearable placeholder="全部状态" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 l:5">
            <NFormItem label="有效期">
              <NSelect
                v-model:value="expirationStatusValue"
                :options="userExpirationOptions"
                clearable
                placeholder="全部"
              />
            </NFormItem>
          </NGi>

          <NGi class="app-filter-actions-cell">
            <div class="app-filter-actions">
              <NSpace :size="8">
                <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
                <NButton size="small" @click="emit('reset')">重置</NButton>
              </NSpace>
            </div>
          </NGi>
        </NGrid>
      </NForm>
    </NSpace>
  </NCard>
</template>
