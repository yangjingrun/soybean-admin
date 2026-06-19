<script setup lang="ts">
import BlacklistTable from './BlacklistTable.vue';
import BlacklistToolbar from './BlacklistToolbar.vue';
import { useBlacklistTable } from './useBlacklistTable';

const {
  filterModel,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleSearch,
  loadBlacklistEntries,
  loading,
  pagination,
  records
} = useBlacklistTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="退订黑名单">
    <NSpace vertical :size="12">
      <NAlert type="warning" :bordered="false">
        客户退订后会进入组织级黑名单，发送前和 worker claim 阶段都会拦截。第一版仅展示，不提供直接解除入口。
      </NAlert>

      <BlacklistToolbar
        v-model="filterModel"
        :loading="loading"
        @refresh="loadBlacklistEntries"
        @reset="handleReset"
        @search="handleSearch"
      />

      <BlacklistTable
        :records="records"
        :loading="loading"
        :page="pagination.current"
        :page-size="pagination.size"
        :total="pagination.total"
        @update-page="handlePageUpdate"
        @update-page-size="handlePageSizeUpdate"
      />
    </NSpace>
  </NCard>
</template>
