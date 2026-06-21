<script setup lang="ts">
import { productLineStatusOptions } from './shared';

const filterModel = defineModel<Api.Crm.ProductLineFilterModel>('modelValue', {
  required: true
});

defineProps<{
  canManage?: boolean;
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
  <NForm :model="filterModel" label-placement="left" label-width="68" size="small">
    <NGrid :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
      <NGi span="24 m:12 xl:8">
        <NFormItem label="关键词">
          <NInput
            v-model:value="filterModel.keyword"
            clearable
            placeholder="产品线 / 客户 / 卖点"
            @keyup.enter="emit('search')"
          />
        </NFormItem>
      </NGi>

      <NGi span="24 m:12 xl:6">
        <NFormItem label="状态">
          <NSelect
            v-model:value="filterModel.status"
            :options="productLineStatusOptions"
            clearable
            placeholder="全部状态"
          />
        </NFormItem>
      </NGi>

      <NGi span="24 xl:10">
        <div class="toolbar-actions">
          <NSpace :size="8">
            <NButton size="small" @click="emit('reset')">重置</NButton>
            <NButton size="small" :loading="loading" @click="emit('refresh')">刷新</NButton>
            <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
            <NButton v-if="canManage" size="small" type="primary" @click="emit('add')">新增产品线</NButton>
          </NSpace>
        </div>
      </NGi>
    </NGrid>
  </NForm>
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1px;
}
</style>
