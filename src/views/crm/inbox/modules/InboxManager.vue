<script setup lang="ts">
import InboxStats from './InboxStats.vue';
import InboxThreadTable from './InboxThreadTable.vue';
import { useInboxTable } from './shared/useInboxTable';

const { handlePageSizeUpdate, handlePageUpdate, loading, openThreadDetail, pagination, pendingTotal, records } =
  useInboxTable();
</script>

<template>
  <NSpace vertical :size="12">
    <InboxStats :records="records" :pending-total="pendingTotal" :total="pagination.total" />

    <InboxThreadTable
      :records="records"
      :loading="loading"
      :page="pagination.current"
      :page-size="pagination.size"
      :total="pagination.total"
      @view="openThreadDetail"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
    />
  </NSpace>
</template>
