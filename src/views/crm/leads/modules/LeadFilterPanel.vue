<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import CrmRegionCascader from '@/components/common/crm-region-cascader.vue';
import { leadStatusOptions } from './shared';

defineProps<{
  model: Api.Crm.LeadFilterModel;
  loading?: boolean;
}>();

const emit = defineEmits<{
  create: [];
  reset: [];
  search: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NForm :model="model" label-placement="left" label-width="72">
      <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="12" cols="1 s:2 m:3 l:4 xl:6">
        <NFormItemGi label="公司">
          <NInput v-model:value="model.keyword" clearable placeholder="公司名 / 域名" @keyup.enter="emit('search')" />
        </NFormItemGi>
        <NFormItemGi label="职位">
          <NInput v-model:value="model.contactTitle" clearable placeholder="联系人职位" @keyup.enter="emit('search')" />
        </NFormItemGi>
        <NFormItemGi label="客户类型">
          <NInput
            v-model:value="model.customerType"
            clearable
            placeholder="进口商 / 经销商"
            @keyup.enter="emit('search')"
          />
        </NFormItemGi>
        <NFormItemGi label="地区">
          <CrmRegionCascader v-model="model.region" />
        </NFormItemGi>
        <NFormItemGi label="状态">
          <NSelect v-model:value="model.status" clearable :options="leadStatusOptions" placeholder="全部状态" />
        </NFormItemGi>
        <NFormItemGi label="时间">
          <NDatePicker v-model:value="model.updatedAtRange" clearable type="daterange" class="lead-filter-date" />
        </NFormItemGi>
      </NGrid>
    </NForm>
    <div class="lead-filter-actions">
      <NSpace :size="8">
        <NButton type="primary" ghost @click="emit('create')">新增客户</NButton>
        <NButton :loading="loading" type="primary" @click="emit('search')">查询</NButton>
        <NButton :disabled="loading" @click="emit('reset')">重置</NButton>
      </NSpace>
    </div>
  </NCard>
</template>

<style scoped>
.lead-filter-date {
  width: 100%;
}

.lead-filter-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
