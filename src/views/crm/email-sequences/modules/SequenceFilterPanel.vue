<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import { sequenceStatusOptions, sequenceTodoTypeOptions } from './shared';

const sequenceMessageStatusOptions = [
  { label: '待确认发送', value: 'draft_pending_review' },
  { label: '等待发送', value: 'draft_ready' },
  { label: '发送中', value: 'queued' },
  { label: '已发送', value: 'sent' },
  { label: '发送失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' }
] satisfies Array<{ label: string; value: Api.Crm.MessageStatus }>;

const sequenceDateScopeOptions = [{ label: '今天', value: 'today' }] satisfies Array<{
  label: string;
  value: NonNullable<Api.Crm.SequenceReviewFilterModel['dateScope']>;
}>;

defineProps<{
  loading?: boolean;
  model: Api.Crm.SequenceReviewFilterModel;
}>();

const emit = defineEmits<{
  reset: [];
  search: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NForm :model="model" label-placement="left" label-width="72">
      <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="12" cols="1 s:2 m:3 l:4 xl:5">
        <NFormItemGi label="公司">
          <NInput
            v-model:value="model.keyword"
            clearable
            placeholder="公司名 / 域名 / 联系人"
            @keyup.enter="emit('search')"
          />
        </NFormItemGi>
        <NFormItemGi label="任务状态">
          <NSelect v-model:value="model.status" clearable :options="sequenceStatusOptions" placeholder="全部状态" />
        </NFormItemGi>
        <NFormItemGi label="待办类型">
          <NSelect v-model:value="model.todoType" clearable :options="sequenceTodoTypeOptions" placeholder="全部待办" />
        </NFormItemGi>
        <NFormItemGi label="邮件状态">
          <NSelect
            v-model:value="model.messageStatus"
            clearable
            :options="sequenceMessageStatusOptions"
            placeholder="全部邮件"
          />
        </NFormItemGi>
        <NFormItemGi label="时间">
          <NSelect
            v-model:value="model.dateScope"
            clearable
            :options="sequenceDateScopeOptions"
            placeholder="全部时间"
          />
        </NFormItemGi>
      </NGrid>
    </NForm>
    <div class="sequence-filter-actions">
      <NSpace :size="8">
        <NButton :loading="loading" type="primary" @click="emit('search')">查询</NButton>
        <NButton :disabled="loading" @click="emit('reset')">重置</NButton>
      </NSpace>
    </div>
  </NCard>
</template>

<style scoped>
.sequence-filter-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
