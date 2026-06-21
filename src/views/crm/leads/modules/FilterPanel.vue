<script setup lang="ts">
import { computed } from 'vue';
import { leadStatusLabelMap, leadStatusOptions } from './shared';

const filterModel = defineModel<Api.Crm.LeadFilterModel>('modelValue', { required: true });

defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const activeFilters = computed(() => {
  const tags: Array<{ key: keyof Api.Crm.LeadFilterModel; label: string }> = [];
  const keyword = filterModel.value.keyword.trim();

  if (keyword) {
    tags.push({ key: 'keyword', label: `关键词：${keyword}` });
  }

  if (filterModel.value.status) {
    tags.push({ key: 'status', label: `状态：${leadStatusLabelMap[filterModel.value.status]}` });
  }

  return tags;
});

/** Clear one active filter and reload the list. */
function clearFilter(key: keyof Api.Crm.LeadFilterModel) {
  if (key === 'keyword') {
    filterModel.value.keyword = '';
  }

  if (key === 'status') {
    filterModel.value.status = null;
  }

  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small">
        <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="24 m:12 xl:8">
            <NFormItem label="关键词">
              <NInput
                v-model:value="filterModel.keyword"
                clearable
                placeholder="公司名 / 域名 / 官网"
                @keyup.enter="emit('search')"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12 xl:6">
            <NFormItem label="状态">
              <NSelect
                v-model:value="filterModel.status"
                :options="leadStatusOptions"
                clearable
                placeholder="全部状态"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 xl:10">
            <div class="filter-actions">
              <NSpace :size="8">
                <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
                <NButton size="small" @click="emit('reset')">重置</NButton>
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
