<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { logLevelLabelMap, logLevelOptions, logModuleOptions, logStatusLabelMap, logStatusOptions } from './shared';

const filterModel = defineModel<Api.SystemLog.SystemLogFilterModel>('modelValue', { required: true });

const props = defineProps<{
  users: Api.SystemLog.SystemLogUser[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const userOptions = computed(() =>
  props.users.map(user => ({
    label: user.userName,
    value: user.userId
  }))
);

const userLabelMap = computed(() => new Map(userOptions.value.map(item => [item.value, item.label])));
const moduleLabelMap = computed(() => new Map(logModuleOptions.map(item => [item.value, item.label])));

const activeFilters = computed(() => {
  const tags: Array<{ key: string; label: string }> = [];
  const model = filterModel.value;

  if (model.timeRange) {
    tags.push({
      key: 'timeRange',
      label: `${dayjs(model.timeRange[0]).format('MM-DD HH:mm')} 至 ${dayjs(model.timeRange[1]).format('MM-DD HH:mm')}`
    });
  }

  if (model.userId) {
    tags.push({ key: 'userId', label: `用户：${userLabelMap.value.get(model.userId) || model.userId}` });
  }

  if (model.module) {
    tags.push({ key: 'module', label: `模块：${moduleLabelMap.value.get(model.module) || model.module}` });
  }

  if (model.level) {
    tags.push({ key: 'level', label: `等级：${logLevelLabelMap[model.level]}` });
  }

  if (model.status) {
    tags.push({ key: 'status', label: `状态：${logStatusLabelMap[model.status]}` });
  }

  const keyword = model.keyword.trim();
  if (keyword) {
    tags.push({ key: 'keyword', label: `关键词：${keyword}` });
  }

  return tags;
});

/** Clear one active filter and refresh the table. */
function clearFilter(key: string) {
  switch (key) {
    case 'timeRange':
      filterModel.value.timeRange = null;
      break;
    case 'userId':
      filterModel.value.userId = null;
      break;
    case 'module':
      filterModel.value.module = null;
      break;
    case 'level':
      filterModel.value.level = null;
      break;
    case 'status':
      filterModel.value.status = null;
      break;
    case 'keyword':
      filterModel.value.keyword = '';
      break;
  }

  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small">
        <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="24 m:12 xl:6">
            <NFormItem label="时间">
              <NDatePicker
                v-model:value="filterModel.timeRange"
                type="datetimerange"
                clearable
                class="full-input"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
              />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 xl:4">
            <NFormItem label="用户">
              <NSelect
                v-model:value="filterModel.userId"
                :options="userOptions"
                clearable
                filterable
                placeholder="全部用户"
              />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 xl:4">
            <NFormItem label="模块">
              <NSelect
                v-model:value="filterModel.module"
                :options="logModuleOptions"
                clearable
                placeholder="全部模块"
              />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 xl:3">
            <NFormItem label="等级">
              <NSelect v-model:value="filterModel.level" :options="logLevelOptions" clearable placeholder="全部" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 xl:3">
            <NFormItem label="状态">
              <NSelect v-model:value="filterModel.status" :options="logStatusOptions" clearable placeholder="全部" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12 xl:4">
            <NFormItem label="关键词">
              <NInput
                v-model:value="filterModel.keyword"
                clearable
                placeholder="消息 / 动作 / 错误"
                @keyup.enter="emit('search')"
              />
            </NFormItem>
          </NGi>
        </NGrid>

        <div class="filter-actions">
          <NSpace :size="8">
            <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
            <NButton size="small" @click="emit('reset')">重置</NButton>
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
.full-input {
  width: 100%;
}

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
