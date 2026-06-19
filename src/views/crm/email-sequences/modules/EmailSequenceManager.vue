<script setup lang="ts">
import DraftReviewDrawer from './DraftReviewDrawer.vue';
import EmailSequenceTable from './EmailSequenceTable.vue';
import EmailSequenceToolbar from './EmailSequenceToolbar.vue';
import SequenceCreateModal from './SequenceCreateModal.vue';
import { useEmailSequenceTable } from './useEmailSequenceTable';

const {
  accountSelectOptions,
  contactSelectOptions,
  createForm,
  createSubmitting,
  createVisible,
  currentItem,
  detailRefreshing,
  draftApproving,
  draftSaving,
  drawerLoading,
  drawerVisible,
  filterModel,
  handleAccountChange,
  handleApproveDraft,
  handleCreateReviewItem,
  handleCreateVisibleUpdate,
  handleDrawerVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleRefreshCurrentSequence,
  handleSaveDraft,
  handleSearch,
  handleStartSend,
  handleStopSequence,
  loadSequences,
  loading,
  mailboxSelectOptions,
  openCreateModal,
  openDraftDrawer,
  pagination,
  productLineSelectOptions,
  records,
  resourceLoading,
  sendStarting,
  sequenceStopping
} = useEmailSequenceTable();
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="邮件序列" subtitle="生成首封开发信草稿，人工审核后进入待发送状态">
      <template #extra>
        <NTag type="info" :bordered="false">首封审核</NTag>
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
      :loading="loading"
      :pagination="pagination"
      :records="records"
      @review="openDraftDrawer"
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
      :refreshing="detailRefreshing"
      :saving="draftSaving"
      :send-starting="sendStarting"
      :stopping="sequenceStopping"
      @approve-draft="handleApproveDraft"
      @refresh="handleRefreshCurrentSequence"
      @save-draft="handleSaveDraft"
      @start-send="handleStartSend"
      @stop="handleStopSequence"
      @update:show="handleDrawerVisibleUpdate"
    />
  </NSpace>
</template>
