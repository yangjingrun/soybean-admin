<script setup lang="ts">
import { computed } from 'vue';
import { roleStatusOptions } from './shared';

const filterModel = defineModel<Api.SystemRole.RoleFilterModel>('modelValue', { required: true });

defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  reset: [];
  search: [];
}>();

const keywordValue = computed({
  get: () => filterModel.value.keyword,
  set: value => {
    filterModel.value.keyword = value;
  }
});

const statusValue = computed({
  get: () => filterModel.value.status,
  set: value => {
    filterModel.value.status = value;
  }
});
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="10">
      <NForm :model="filterModel" label-placement="left" label-width="68" size="small" :show-feedback="false">
        <NGrid class="app-filter-grid" :cols="24" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="24 m:14">
            <NFormItem label="关键词">
              <NInput
                v-model:value="keywordValue"
                clearable
                placeholder="角色名称 / 角色编码 / 描述"
                @keyup.enter="emit('search')"
              />
            </NFormItem>
          </NGi>
          <NGi span="24 m:10">
            <NFormItem label="状态">
              <NSelect v-model:value="statusValue" :options="roleStatusOptions" clearable placeholder="全部状态" />
            </NFormItem>
          </NGi>

          <NGi class="app-filter-actions-cell">
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
