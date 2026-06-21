<script setup lang="ts">
import { inboxThreadStatusOptions } from './shared';

const filterModel = defineModel<Api.Crm.InboxThreadFilterModel>('modelValue', { required: true });

defineProps<{
  loading?: boolean;
  mailboxLoading?: boolean;
  mailboxOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  reset: [];
  search: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small" :show-feedback="false">
        <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="24 m:12 xl:7">
            <NFormItem label="关键词">
              <NInput
                v-model:value="filterModel.keyword"
                clearable
                placeholder="主题 / 线索 / 联系人"
                @keyup.enter="emit('search')"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12 xl:5">
            <NFormItem label="状态">
              <NSelect
                v-model:value="filterModel.status"
                :options="inboxThreadStatusOptions"
                clearable
                placeholder="全部状态"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12 xl:6">
            <NFormItem label="邮箱">
              <NSelect
                v-model:value="filterModel.mailboxId"
                :loading="mailboxLoading"
                :options="mailboxOptions"
                clearable
                filterable
                placeholder="全部邮箱"
              />
            </NFormItem>
          </NGi>

          <NGi class="app-filter-actions-cell" span="24 m:12 xl:6">
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
