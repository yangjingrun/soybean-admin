<script setup lang="ts">
import DraftReviewDrawer from './DraftReviewDrawer.vue';
import EmailSequenceTable from './EmailSequenceTable.vue';
import EmailSequenceToolbar from './EmailSequenceToolbar.vue';
import SequenceCreateModal from './SequenceCreateModal.vue';
import { useEmailSequenceTable } from './useEmailSequenceTable';

const {
  accountSelectOptions,
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
  handleBatchGenerateNextDrafts,
  handleBatchStopSequences,
  handleCheckedRowKeysUpdate,
  handleCreateReviewItem,
  handleCreateVisibleUpdate,
  handleDrawerVisibleUpdate,
  handleGenerateNextDraft,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleRefreshCurrentSequence,
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
  resourceLoading,
  sendStarting,
  sequencePolicySelectOptions,
  sequenceStopping
} = useEmailSequenceTable();
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="邮件序列" subtitle="审核首封与后续跟进草稿，控制序列发送状态">
      <template #extra>
        <NTag type="info" :bordered="false">序列审核</NTag>
      </template>
    </NPageHeader>

    <EmailSequenceToolbar
      v-model:filter-model="filterModel"
      :loading="loading"
      @create="openCreateModal"
      @refresh="loadSequences"
      @reset="handleReset"
      @search="handleSearch"
    />

    <EmailSequenceTable
      :batch-draft-approving="batchDraftApproving"
      :batch-next-draft-generating="batchNextDraftGenerating"
      :batch-sequence-stopping="batchSequenceStopping"
      :checked-row-keys="checkedRowKeys"
      :loading="loading"
      :pagination="pagination"
      :records="records"
      @batch-approve-drafts="handleBatchApproveDrafts"
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
  </NSpace>
</template>
