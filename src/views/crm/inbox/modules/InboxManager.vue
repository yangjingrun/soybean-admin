<script setup lang="ts">
import InboxFilterPanel from './InboxFilterPanel.vue';
import InboxStats from './InboxStats.vue';
import InboxThreadDrawer from './InboxThreadDrawer.vue';
import InboxThreadTable from './InboxThreadTable.vue';
import { useInboxTable } from './shared/useInboxTable';

const {
  currentDetail,
  detailLoading,
  detailVisible,
  filterModel,
  handleDetailVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleSearch,
  handleUpdateStatus,
  loadThreadDetail,
  loading,
  mailboxLoading,
  mailboxOptions,
  openThreadDetail,
  pagination,
  pendingTotal,
  records,
  statusOperating,
  statusSubmitting
} = useInboxTable();
</script>

<template>
  <NSpace vertical :size="12">
    <InboxFilterPanel
      v-model="filterModel"
      :loading="loading"
      :mailbox-loading="mailboxLoading"
      :mailbox-options="mailboxOptions"
      @search="handleSearch"
      @reset="handleReset"
    />

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

    <InboxThreadDrawer
      :show="detailVisible"
      :detail="currentDetail"
      :loading="detailLoading"
      :status-operating="statusOperating"
      :status-submitting="statusSubmitting"
      @update:show="handleDetailVisibleUpdate"
      @reload="loadThreadDetail()"
      @submit-status="handleUpdateStatus"
    />
  </NSpace>
</template>
