<script setup lang="ts">
import { sequenceStatusOptions, sequenceTodoTypeOptions } from './shared';

defineProps<{
  loading?: boolean;
}>();

const filterModel = defineModel<Api.Crm.SequenceReviewFilterModel>('filterModel', { required: true });

const emit = defineEmits<{
  create: [];
  refresh: [];
  reset: [];
  search: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NForm :model="filterModel" label-placement="left" label-width="80" :show-feedback="false">
      <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="12">
        <NGi span="24 s:12 l:7">
          <NFormItem label="关键词">
            <NInput v-model:value="filterModel.keyword" clearable placeholder="公司、域名、联系人、职位" />
          </NFormItem>
        </NGi>
        <NGi span="24 s:12 l:5">
          <NFormItem label="状态">
            <NSelect
              v-model:value="filterModel.status"
              clearable
              :options="sequenceStatusOptions"
              placeholder="全部状态"
            />
          </NFormItem>
        </NGi>
        <NGi span="24 s:12 l:5">
          <NFormItem label="待办">
            <NSelect
              v-model:value="filterModel.todoType"
              clearable
              :options="sequenceTodoTypeOptions"
              placeholder="全部待办"
            />
          </NFormItem>
        </NGi>
        <NGi span="24 l:7">
          <NSpace justify="end">
            <NButton :loading="loading" @click="emit('reset')">重置</NButton>
            <NButton type="primary" :loading="loading" @click="emit('search')">查询</NButton>
            <NButton @click="emit('refresh')">刷新</NButton>
            <NButton type="primary" ghost @click="emit('create')">生成首封草稿</NButton>
          </NSpace>
        </NGi>
      </NGrid>
    </NForm>
  </NCard>
</template>
