<script setup lang="ts">
import BulkAiDraftTaskDrawer from './BulkAiDraftTaskDrawer.vue';
import DraftReviewDrawer from './DraftReviewDrawer.vue';
import EmailSequenceTable from './EmailSequenceTable.vue';
import EmailSequenceToolbar from './EmailSequenceToolbar.vue';
import SequenceCreateModal from './SequenceCreateModal.vue';
import { useEmailSequenceTable } from './useEmailSequenceTable';

const {
  accountSelectOptions,
  aiDraftTaskCancelling,
  aiDraftTaskCreating,
  aiDraftTaskDetail,
  aiDraftTaskDrawerVisible,
  aiDraftTaskLoading,
  aiDraftTaskReading,
  aiDraftTaskRetrying,
  batchDraftApproving,
  batchNextDraftGenerating,
  batchSequenceStopping,
  checkedRowKeys,
  contactSelectOptions,
  createForm,
  createSubmitting,
  createVisible,
  currentItem,
  detailRefreshing,
  draftApproving,
  draftSaving,
  draftVersionLoading,
  draftVersionRestoring,
  draftVersions,
  drawerLoading,
  drawerVisible,
  filterModel,
  handleAccountChange,
  handleApproveDraft,
  handleBatchApproveDrafts,
  handleAiDraftTaskDrawerVisibleUpdate,
  handleBatchGenerateNextDrafts,
  handleBatchStopSequences,
  handleCancelAiDraftTask,
  handleCheckedRowKeysUpdate,
  handleCreateAiDraftTask,
  handleCreateReviewItem,
  handleCreateVisibleUpdate,
  handleDrawerVisibleUpdate,
  handleGenerateNextDraft,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleRefreshCurrentSequence,
  handleReadAiDraftTask,
  handleRetryAiDraftTask,
  handleRestoreDraftVersion,
  handleSaveDraft,
  handleSearch,
  handleStartSend,
  handleStopSequence,
  loadDraftVersions,
  loadSequences,
  loading,
  mailboxSelectOptions,
  nextDraftGenerating,
  openCreateModal,
  openDraftDrawer,
  pagination,
  productLineSelectOptions,
  records,
  refreshAiDraftTaskDetail,
  resourceLoading,
  sendStarting,
  sequencePolicySelectOptions,
  sequenceStopping
} = useEmailSequenceTable();
</script>

<template>
  <NSpace vertical :size="12">
    <EmailSequenceToolbar
      v-model:filter-model="filterModel"
      :loading="loading"
      @create="openCreateModal"
      @refresh="loadSequences"
      @reset="handleReset"
      @search="handleSearch"
    />

    <EmailSequenceTable
      :ai-draft-task-creating="aiDraftTaskCreating"
      :batch-draft-approving="batchDraftApproving"
      :batch-next-draft-generating="batchNextDraftGenerating"
      :batch-sequence-stopping="batchSequenceStopping"
      :checked-row-keys="checkedRowKeys"
      :loading="loading"
      :pagination="pagination"
      :records="records"
      @batch-approve-drafts="handleBatchApproveDrafts"
      @create-ai-draft-task="handleCreateAiDraftTask"
      @batch-generate-next-drafts="handleBatchGenerateNextDrafts"
      @batch-stop-sequences="handleBatchStopSequences"
      @review="openDraftDrawer"
      @update-checked-row-keys="handleCheckedRowKeysUpdate"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
    />

    <SequenceCreateModal
      v-model:form-model="createForm"
      :show="createVisible"
      :account-options="accountSelectOptions"
      :contact-options="contactSelectOptions"
      :loading="resourceLoading"
      :mailbox-options="mailboxSelectOptions"
      :product-line-options="productLineSelectOptions"
      :sequence-policy-options="sequencePolicySelectOptions"
      :submitting="createSubmitting"
      @account-change="handleAccountChange"
      @submit="handleCreateReviewItem"
      @update:show="handleCreateVisibleUpdate"
    />

    <DraftReviewDrawer
      :show="drawerVisible"
      :approving="draftApproving"
      :item="currentItem"
      :loading="drawerLoading"
      :next-draft-generating="nextDraftGenerating"
      :refreshing="detailRefreshing"
      :saving="draftSaving"
      :send-starting="sendStarting"
      :stopping="sequenceStopping"
      :version-loading="draftVersionLoading"
      :version-restoring="draftVersionRestoring"
      :versions="draftVersions"
      @approve-draft="handleApproveDraft"
      @generate-next-draft="handleGenerateNextDraft"
      @load-draft-versions="loadDraftVersions"
      @refresh="handleRefreshCurrentSequence"
      @restore-draft-version="handleRestoreDraftVersion"
      @save-draft="handleSaveDraft"
      @start-send="handleStartSend"
      @stop="handleStopSequence"
      @update:show="handleDrawerVisibleUpdate"
    />

    <BulkAiDraftTaskDrawer
      :show="aiDraftTaskDrawerVisible"
      :cancelling="aiDraftTaskCancelling"
      :detail="aiDraftTaskDetail"
      :loading="aiDraftTaskLoading"
      :reading="aiDraftTaskReading"
      :retrying="aiDraftTaskRetrying"
      @cancel="handleCancelAiDraftTask"
      @read="handleReadAiDraftTask"
      @refresh="refreshAiDraftTaskDetail()"
      @retry="handleRetryAiDraftTask"
      @update:show="handleAiDraftTaskDrawerVisibleUpdate"
    />
  </NSpace>
</template>
