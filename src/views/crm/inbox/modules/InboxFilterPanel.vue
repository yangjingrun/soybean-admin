<script setup lang="ts">
import { computed } from 'vue';
import { inboxThreadStatusLabelMap, inboxThreadStatusOptions } from './shared';

const filterModel = defineModel<Api.Crm.InboxThreadFilterModel>('modelValue', { required: true });

const props = defineProps<{
  loading?: boolean;
  mailboxLoading?: boolean;
  mailboxOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  reset: [];
  search: [];
}>();

const mailboxLabelMap = computed(() =>
  props.mailboxOptions.reduce<Record<string, string>>((map, option) => {
    map[option.value] = option.label;
    return map;
  }, {})
);
const activeFilters = computed(() => {
  const tags: Array<{ key: keyof Api.Crm.InboxThreadFilterModel; label: string }> = [];
  const keyword = filterModel.value.keyword.trim();

  if (keyword) {
    tags.push({ key: 'keyword', label: `关键词：${keyword}` });
  }

  if (filterModel.value.status) {
    tags.push({ key: 'status', label: `状态：${inboxThreadStatusLabelMap[filterModel.value.status]}` });
  }

  if (filterModel.value.mailboxId) {
    tags.push({
      key: 'mailboxId',
      label: `邮箱：${mailboxLabelMap.value[filterModel.value.mailboxId]}`
    });
  }

  return tags;
});

/** Clear one active filter and reload the inbox list. */
function clearFilter(key: keyof Api.Crm.InboxThreadFilterModel) {
  if (key === 'keyword') {
    filterModel.value.keyword = '';
  }

  if (key === 'status') {
    filterModel.value.status = null;
  }

  if (key === 'mailboxId') {
    filterModel.value.mailboxId = null;
  }

  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small">
        <NGrid :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
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

          <NGi span="24 m:12 xl:6">
            <div class="filter-actions">
              <NSpace :size="8">
                <NButton size="small" @click="emit('reset')">重置</NButton>
                <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
              </NSpace>
            </div>
          </NGi>
        </NGrid>
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
  padding-top: 1px;
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
