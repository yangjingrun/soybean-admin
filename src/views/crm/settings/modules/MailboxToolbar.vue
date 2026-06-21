<script setup lang="ts">
import { mailboxStatusOptions } from './shared';

const filterModel = defineModel<Api.Crm.MailboxFilterModel>('modelValue', {
  required: true
});

defineProps<{
  authorizing?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  add: [];
  refresh: [];
  reset: [];
  search: [];
}>();
</script>

<template>
  <NSpace vertical :size="10">
    <NForm :model="filterModel" label-placement="left" label-width="68" size="small" :show-feedback="false">
      <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
        <NGi span="24 m:12 xl:8">
          <NFormItem label="关键词">
            <NInput
              v-model:value="filterModel.keyword"
              clearable
              placeholder="邮箱 / 负责人"
              @keyup.enter="emit('search')"
            />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12 xl:6">
          <NFormItem label="状态">
            <NSelect
              v-model:value="filterModel.status"
              :options="mailboxStatusOptions"
              clearable
              placeholder="全部状态"
            />
          </NFormItem>
        </NGi>

        <NGi class="app-filter-actions-cell app-filter-actions-cell--wide" span="24 xl:10">
          <div class="app-filter-actions">
            <NSpace :size="8">
              <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
              <NButton size="small" @click="emit('reset')">重置</NButton>
              <NButton size="small" :loading="loading" @click="emit('refresh')">刷新</NButton>
              <NButton size="small" type="primary" :loading="authorizing" @click="emit('add')">新增授权</NButton>
            </NSpace>
          </div>
        </NGi>
      </NGrid>
    </NForm>
  </NSpace>
</template>
