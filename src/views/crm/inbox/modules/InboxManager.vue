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
  draftPolishing,
  draftSaving,
  filterModel,
  handleConfirmUnsubscribe,
  handleDetailVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handlePolishReplyDraft,
  handleReset,
  handleSaveReplyDraft,
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
  replyBody,
  replyTopic,
  statusOperating,
  statusSubmitting,
  unsubscribeConfirming
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
      v-model:reply-body="replyBody"
      v-model:reply-topic="replyTopic"
      :show="detailVisible"
      :detail="currentDetail"
      :draft-polishing="draftPolishing"
      :draft-saving="draftSaving"
      :loading="detailLoading"
      :status-operating="statusOperating"
      :status-submitting="statusSubmitting"
      :unsubscribe-confirming="unsubscribeConfirming"
      @update:show="handleDetailVisibleUpdate"
      @confirm-unsubscribe="handleConfirmUnsubscribe"
      @reload="loadThreadDetail()"
      @polish-reply-draft="handlePolishReplyDraft"
      @save-reply-draft="handleSaveReplyDraft"
      @submit-status="handleUpdateStatus"
    />
  </NSpace>
</template>
