<script setup lang="ts">
import LeadDetailDrawer from './modules/LeadDetailDrawer.vue';
import LeadFilterPanel from './modules/LeadFilterPanel.vue';
import LeadImportModal from './modules/LeadImportModal.vue';
import LeadStats from './modules/LeadStats.vue';
import LeadTable from './modules/LeadTable.vue';
import { useLeadTable } from './modules/shared/useLeadTable';

const {
  archiveOperatingId,
  accountSubmitting,
  contactDeletingId,
  contactSubmitting,
  detailLoading,
  detailVisible,
  filterModel,
  handleArchiveLead,
  handleUpdateAccount,
  handleCreateSequenceFromContact,
  handleCreateContact,
  handleCreateNote,
  handleDeleteContact,
  handleDetailVisibleUpdate,
  handleImportLead,
  handleImportVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleRefreshAccountEnrichment,
  handleReset,
  handleRestoreLead,
  handleSearch,
  handleUpdateContact,
  handleUpdateStatus,
  handleVerifyContactEmail,
  importForm,
  importSubmitting,
  importVisible,
  leadDetail,
  loadLeadDetail,
  loading,
  noteSubmitting,
  openImportModal,
  openLeadDetail,
  pagination,
  refreshingEnrichmentProvider,
  records,
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
      @create="openImportModal"
      @search="handleSearch"
      @reset="handleReset"
    />

    <LeadStats :records="records" :total="pagination.total" />

    <LeadTable
      :records="records"
      :loading="loading"
      :archive-operating-id="archiveOperatingId"
      :page="pagination.current"
      :page-size="pagination.size"
      :total="pagination.total"
      @view="openLeadDetail"
      @change-status="openLeadDetail"
      @archive="handleArchiveLead"
      @restore="handleRestoreLead"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
    />

    <LeadDetailDrawer
      :show="detailVisible"
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
  </NSpace>
</template>
