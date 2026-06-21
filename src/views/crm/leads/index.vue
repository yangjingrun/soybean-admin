<script setup lang="ts">
import FilterPanel from './modules/FilterPanel.vue';
import LeadDetailDrawer from './modules/LeadDetailDrawer.vue';
import LeadImportModal from './modules/LeadImportModal.vue';
import LeadStats from './modules/LeadStats.vue';
import LeadTable from './modules/LeadTable.vue';
import { useLeadTable } from './modules/shared/useLeadTable';

const {
  archiveOperatingId,
  detailLoading,
  detailVisible,
  filterModel,
  handleArchiveLead,
  handleCreateSequenceFromContact,
  handleCreateNote,
  handleDetailVisibleUpdate,
  handleImportLead,
  handleImportVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleRefreshAccountEnrichment,
  handleRestoreLead,
  handleSearch,
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
    <FilterPanel
      v-model="filterModel"
      :loading="loading"
      @add="openImportModal"
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
      :note-submitting="noteSubmitting"
      :status-submitting="statusSubmitting"
      :verifying-contact-ids="verifyingContactIds"
      :refreshing-enrichment-provider="refreshingEnrichmentProvider"
      @update:show="handleDetailVisibleUpdate"
      @create-sequence="handleCreateSequenceFromContact"
      @refresh-enrichment="handleRefreshAccountEnrichment"
      @reload="loadLeadDetail()"
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
