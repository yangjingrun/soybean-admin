<script setup lang="ts">
import { computed } from 'vue';
import { buildSequenceReviewFilterTags, sequenceStatusOptions, sequenceTodoTypeOptions } from './shared';

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

const activeFilters = computed(() => buildSequenceReviewFilterTags(filterModel.value));

/** Clear one route or manual filter and reload the review queue. */
function clearFilter(key: keyof Api.Crm.SequenceReviewFilterModel) {
  if (key === 'keyword') {
    filterModel.value.keyword = '';
  }

  if (key === 'status') {
    filterModel.value.status = null;
  }

  if (key === 'todoType') {
    filterModel.value.todoType = null;
  }

  if (key === 'messageStatus') {
    filterModel.value.messageStatus = null;
  }

  if (key === 'dateScope') {
    filterModel.value.dateScope = null;
  }

  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
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

      <div v-if="activeFilters.length" class="active-filter-row">
        <span class="active-filter-label">当前队列</span>
        <NTag
          v-for="item in activeFilters"
          :key="item.key"
          size="small"
          round
          closable
          @close="clearFilter(item.key)"
        >
          {{ item.label }}
        </NTag>
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
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
