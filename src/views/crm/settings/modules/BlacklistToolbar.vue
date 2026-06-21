<script setup lang="ts">
const filterModel = defineModel<Api.Crm.BlacklistFilterModel>('modelValue', { required: true });

defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  reset: [];
  search: [];
}>();
</script>

<template>
  <NForm :model="filterModel" label-placement="left" label-width="68" size="small" :show-feedback="false">
    <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
      <NGi span="24 m:12 xl:8">
        <NFormItem label="关键词">
          <NInput
            v-model:value="filterModel.keyword"
            clearable
            placeholder="脱敏邮箱 / 创建人"
            @keyup.enter="emit('search')"
          />
        </NFormItem>
      </NGi>

      <NGi class="app-filter-actions-cell app-filter-actions-cell--wide" span="24 xl:16">
        <div class="app-filter-actions">
          <NSpace :size="8">
            <NButton size="small" type="primary" :loading="loading" @click="emit('search')">查询</NButton>
            <NButton size="small" @click="emit('reset')">重置</NButton>
            <NButton size="small" :loading="loading" @click="emit('refresh')">刷新</NButton>
          </NSpace>
        </div>
      </NGi>
    </NGrid>
  </NForm>
</template>
