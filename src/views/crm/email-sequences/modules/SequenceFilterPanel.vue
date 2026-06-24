<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import FilterPanel from '@/components/common/filter-panel.vue';
import { sequenceCreatedAtScopeLabelMap } from './shared';

const sequenceProgressOptions = Array.from({ length: 5 }, (_, index) => {
  const step = index + 1;

  return {
    label: `第 ${step} 封`,
    value: step
  };
});

const sequenceCreatedAtScopes = Object.keys(sequenceCreatedAtScopeLabelMap) as Api.Crm.SequenceReviewCreatedAtScope[];

const sequenceCreatedAtScopeOptions = sequenceCreatedAtScopes.map(value => ({
  label: sequenceCreatedAtScopeLabelMap[value],
  value
})) satisfies Array<{
  label: string;
  value: Api.Crm.SequenceReviewCreatedAtScope;
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
  <FilterPanel :model="model" cols="1 s:2 m:3 l:4 xl:5">
    <NFormItemGi label="公司域名">
      <NInput v-model:value="model.keyword" clearable placeholder="公司名 / 域名" @keyup.enter="emit('search')" />
    </NFormItemGi>
    <NFormItemGi label="跟进进度">
      <NSelect v-model:value="model.currentStep" clearable :options="sequenceProgressOptions" placeholder="全部进度" />
    </NFormItemGi>
    <NFormItemGi label="创建时间">
      <NSelect
        v-model:value="model.createdAtScope"
        clearable
        :options="sequenceCreatedAtScopeOptions"
        placeholder="全部时间"
      />
    </NFormItemGi>
    <template #actions>
      <NButton :loading="loading" type="primary" @click="emit('search')">查询</NButton>
      <NButton :disabled="loading" @click="emit('reset')">重置</NButton>
    </template>
  </FilterPanel>
</template>
