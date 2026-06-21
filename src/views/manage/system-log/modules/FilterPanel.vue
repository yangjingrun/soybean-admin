<script setup lang="ts">
import { computed } from 'vue';
import { logLevelOptions, logModuleOptions, logStatusOptions } from './shared';

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
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small" :show-feedback="false">
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

<style scoped>
.full-input {
  width: 100%;
}
</style>
