<script setup lang="ts">
import BulkAiDraftTaskDrawer from './BulkAiDraftTaskDrawer.vue';
import DraftReviewModal from './DraftReviewModal.vue';
import EmailSequenceTable from './EmailSequenceTable.vue';
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
  draftRegenerating,
  draftSaving,
  draftVersionLoading,
  draftVersionRestoring,
  draftVersions,
  drawerLoading,
  drawerVisible,
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
  handleRegenerateAiDraft,
  handleResumeSequence,
  handleRetryFirstMessageSend,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleRefreshCurrentSequence,
  handleReturnFirstMessageToEdit,
  handleReadAiDraftTask,
  handleRetryAiDraftTask,
  handleRestoreDraftVersion,
  handleSaveDraft,
  handleStartSend,
  handleStopSequence,
  loadDraftVersions,
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
  returnEditing,
  sendStarting,
  sendRetrying,
  sequenceResuming,
  sequencePolicySelectOptions,
  sequenceStopping
} = useEmailSequenceTable();
</script>

<template>
  <NSpace vertical :size="12">
    <NSpace justify="end">
      <NButton type="primary" ghost @click="openCreateModal">创建开发任务</NButton>
    </NSpace>

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

    <DraftReviewModal
      :show="drawerVisible"
      :approving="draftApproving"
      :item="currentItem"
      :loading="drawerLoading"
      :next-draft-generating="nextDraftGenerating"
      :regenerating="draftRegenerating"
      :refreshing="detailRefreshing"
      :return-editing="returnEditing"
      :saving="draftSaving"
      :send-starting="sendStarting"
      :send-retrying="sendRetrying"
      :sequence-resuming="sequenceResuming"
      :stopping="sequenceStopping"
      :version-loading="draftVersionLoading"
      :version-restoring="draftVersionRestoring"
      :versions="draftVersions"
      @approve-draft="handleApproveDraft"
      @generate-next-draft="handleGenerateNextDraft"
      @load-draft-versions="loadDraftVersions"
      @regenerate-draft="handleRegenerateAiDraft"
      @resume="handleResumeSequence"
      @refresh="handleRefreshCurrentSequence"
      @return-to-edit="handleReturnFirstMessageToEdit"
      @retry-send="handleRetryFirstMessageSend"
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
