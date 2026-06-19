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
  records,
  statusSubmitting,
  verifyingContactIds
} = useLeadTable();
</script>

<template>
  <NSpace vertical :size="12">
    <div class="lead-page-actions">
      <NButton type="primary" @click="openImportModal">新增线索</NButton>
    </div>

    <FilterPanel v-model="filterModel" :loading="loading" @search="handleSearch" @reset="handleReset" />

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
      @update:show="handleDetailVisibleUpdate"
      @create-sequence="handleCreateSequenceFromContact"
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

<style scoped>
.lead-page-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
