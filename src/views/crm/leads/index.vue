<script setup lang="ts">
import LeadDetailDrawer from './modules/LeadDetailDrawer.vue';
import LeadFilterPanel from './modules/LeadFilterPanel.vue';
import LeadImportModal from './modules/LeadImportModal.vue';
import LeadSequenceCreateModal from './modules/LeadSequenceCreateModal.vue';
import LeadStats from './modules/LeadStats.vue';
import LeadTable from './modules/LeadTable.vue';
import { useLeadTable } from './modules/shared/useLeadTable';

const {
  archiveOperatingId,
  accountSubmitting,
  contactDeletingId,
  contactSubmitting,
  detailActiveContactId,
  detailActiveTab,
  detailLoading,
  detailVisible,
  expandedLeadDetails,
  expandedLeadFailedIds,
  expandedLeadLoadingIds,
  expandedRowKeys,
  filterModel,
  checkedLeadRowKeys,
  checkedLeadSequenceTargets,
  clearingOutreachState,
  handleArchiveLead,
  handleClearOutreachState,
  handleCheckedLeadRowKeysUpdate,
  handleUpdateAccount,
  handleCreateSequencesFromTargets,
  handleCreateSequenceFromContact,
  handleCreateContact,
  handleCreateNote,
  handleDeleteContact,
  handleDetailActiveTabUpdate,
  handleDetailVisibleUpdate,
  handleExpandedRowKeysUpdate,
  handleImportLead,
  handleImportVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleOpenBatchSequenceCreateModal,
  handleRefreshAccountEnrichment,
  handleReset,
  handleRestoreLead,
  handleSearch,
  handleSequenceCreateVisibleUpdate,
  handleUpdateContact,
  handleUpdateStatus,
  handleVerifyContactEmail,
  importForm,
  importSubmitting,
  importVisible,
  leadDetail,
  loadExpandedLeadDetail,
  loadLeadDetail,
  loading,
  noteSubmitting,
  openImportModal,
  openLeadDetail,
  pagination,
  refreshingEnrichmentProvider,
  records,
  sequenceCreateForm,
  sequenceCreateSubmitting,
  sequenceCreateVisible,
  sequenceMailboxSelectOptions,
  sequencePolicySelectOptions,
  sequenceProductLineSelectOptions,
  sequenceResourceLoading,
  sequenceTargets,
  statusSubmitting,
  verifyingContactIds
} = useLeadTable();
</script>

<template>
  <NSpace vertical :size="12">
    <NAlert v-if="filterModel.sourceTaskId" type="info" :bordered="false">
      正在处理本次 AI 采集客户。优先补齐联系人、验证邮箱，再从可开发客户创建开发信。
    </NAlert>

    <LeadFilterPanel
      :model="filterModel"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <LeadStats :records="records" :total="pagination.total" />

    <LeadTable
      :records="records"
      :checked-row-keys="checkedLeadRowKeys"
      :checked-sequence-target-count="checkedLeadSequenceTargets.length"
      :loading="loading"
      :clearing-outreach-state="clearingOutreachState"
      :archive-operating-id="archiveOperatingId"
      :expanded-lead-details="expandedLeadDetails"
      :expanded-lead-failed-ids="expandedLeadFailedIds"
      :expanded-lead-loading-ids="expandedLeadLoadingIds"
      :expanded-row-keys="expandedRowKeys"
      :page="pagination.current"
      :page-size="pagination.size"
      :total="pagination.total"
      :verifying-contact-ids="verifyingContactIds"
      @open-communication="openLeadDetail"
      @archive="handleArchiveLead"
      @batch-create-sequence="handleOpenBatchSequenceCreateModal"
      @clear-outreach-state="handleClearOutreachState"
      @create="openImportModal"
      @create-sequence="handleCreateSequenceFromContact"
      @load-expanded-contacts="loadExpandedLeadDetail"
      @restore="handleRestoreLead"
      @update-checked-row-keys="handleCheckedLeadRowKeysUpdate"
      @update-expanded-row-keys="handleExpandedRowKeysUpdate"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
      @verify-contact-email="handleVerifyContactEmail"
    />

    <LeadDetailDrawer
      :show="detailVisible"
      :active-tab="detailActiveTab"
      :active-contact-id="detailActiveContactId"
      :detail="leadDetail"
      :loading="detailLoading"
      :account-submitting="accountSubmitting"
      :contact-deleting-id="contactDeletingId"
      :contact-submitting="contactSubmitting"
      :note-submitting="noteSubmitting"
      :status-submitting="statusSubmitting"
      :verifying-contact-ids="verifyingContactIds"
      :refreshing-enrichment-provider="refreshingEnrichmentProvider"
      @update:show="handleDetailVisibleUpdate"
      @update:active-tab="handleDetailActiveTabUpdate"
      @create-sequence="handleCreateSequenceFromContact"
      @create-contact="handleCreateContact"
      @delete-contact="handleDeleteContact"
      @refresh-enrichment="handleRefreshAccountEnrichment"
      @reload="loadLeadDetail()"
      @submit-account="handleUpdateAccount"
      @update-contact="handleUpdateContact"
      @submit-note="handleCreateNote"
      @submit-status="handleUpdateStatus"
      @verify-contact-email="handleVerifyContactEmail"
    />

    <LeadImportModal
      v-model:visible="importVisible"
      v-model="importForm"
      :submitting="importSubmitting"
      @update:visible="handleImportVisibleUpdate"
      @submit="handleImportLead"
    />

    <LeadSequenceCreateModal
      v-model:show="sequenceCreateVisible"
      v-model:form-model="sequenceCreateForm"
      :targets="sequenceTargets"
      :loading="sequenceResourceLoading"
      :mailbox-options="sequenceMailboxSelectOptions"
      :product-line-options="sequenceProductLineSelectOptions"
      :sequence-policy-options="sequencePolicySelectOptions"
      :submitting="sequenceCreateSubmitting"
      @update:show="handleSequenceCreateVisibleUpdate"
      @submit="handleCreateSequencesFromTargets"
    />
  </NSpace>
</template>
