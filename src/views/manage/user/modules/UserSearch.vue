<script setup lang="ts">
import { computed } from 'vue';
import {
  userExpirationLabelMap,
  userExpirationOptions,
  userRoleLabelMap,
  userRoleOptions,
  userStatusLabelMap,
  userStatusOptions
} from './shared';

const filterModel = defineModel<Api.SystemUser.UserFilterModel>('modelValue', { required: true });

defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

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

const activeFilters = computed(() => {
  const tags: Array<{ key: keyof Api.SystemUser.UserFilterModel; label: string }> = [];
  const model = filterModel.value;
  const keyword = model.keyword.trim();

  if (keyword) {
    tags.push({ key: 'keyword', label: `关键词：${keyword}` });
  }

  if (model.role) {
    tags.push({ key: 'role', label: `角色：${userRoleLabelMap.get(model.role) || model.role}` });
  }

  if (model.status) {
    tags.push({ key: 'status', label: `状态：${userStatusLabelMap[model.status]}` });
  }

  if (model.expirationStatus) {
    tags.push({ key: 'expirationStatus', label: `有效期：${userExpirationLabelMap[model.expirationStatus]}` });
  }

  return tags;
});

/** Clear one active filter and refresh the table. */
function clearFilter(key: keyof Api.SystemUser.UserFilterModel) {
  if (key === 'keyword') {
    filterModel.value.keyword = '';
  }

  if (key === 'role') {
    filterModel.value.role = null;
  }

  if (key === 'status') {
    filterModel.value.status = null;
  }

  if (key === 'expirationStatus') {
    filterModel.value.expirationStatus = null;
  }

  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small">
        <NGrid :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
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
              <NSelect v-model:value="roleValue" :options="userRoleOptions" clearable placeholder="全部角色" />
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
        </NGrid>

        <div class="filter-actions">
          <NSpace :size="8">
            <NButton size="small" @click="emit('reset')">重置</NButton>
            <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
          </NSpace>
        </div>
      </NForm>

      <div v-if="activeFilters.length" class="active-filter-row">
        <span class="active-filter-label">当前筛选</span>
        <NTag v-for="item in activeFilters" :key="item.key" size="small" round closable @close="clearFilter(item.key)">
          {{ item.label }}
        </NTag>
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
.filter-actions {
  display: flex;
  justify-content: flex-end;
}

.active-filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.active-filter-label {
  color: var(--n-text-color-3);
  font-size: 13px;
}
</style>
