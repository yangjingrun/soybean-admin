<script setup lang="ts">
import EmailTemplateFormModal from './EmailTemplateFormModal.vue';
import EmailTemplateTable from './EmailTemplateTable.vue';
import EmailTemplateToolbar from './EmailTemplateToolbar.vue';
import { useEmailTemplateTable } from './useEmailTemplateTable';

const {
  canManage,
  editingTemplateId,
  filterModel,
  formModel,
  formVisible,
  handleArchiveEmailTemplate,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleSearch,
  handleSetDefaultEmailTemplate,
  handleSubmitEmailTemplate,
  loadEmailTemplates,
  loading,
  openCreateModal,
  openEditModal,
  operatingTemplateId,
  pagination,
  records,
  submitting
} = useEmailTemplateTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="邮件模板库">
    <NSpace vertical :size="12">
      <EmailTemplateToolbar
        v-model="filterModel"
        :can-manage="canManage"
        :loading="loading"
        @add="openCreateModal"
        @refresh="loadEmailTemplates"
        @reset="handleReset"
        @search="handleSearch"
      />

      <EmailTemplateTable
        :records="records"
        :can-manage="canManage"
        :loading="loading"
        :operating-template-id="operatingTemplateId"
        :page="pagination.current"
        :page-size="pagination.size"
        :total="pagination.total"
        @archive="handleArchiveEmailTemplate"
        @edit="openEditModal"
        @set-default="handleSetDefaultEmailTemplate"
        @update-page="handlePageUpdate"
        @update-page-size="handlePageSizeUpdate"
      />
    </NSpace>
  </NCard>

  <EmailTemplateFormModal
    v-model:visible="formVisible"
    v-model="formModel"
    :mode="editingTemplateId ? 'edit' : 'create'"
    :submitting="submitting"
    @submit="handleSubmitEmailTemplate"
    @update:visible="handleFormVisibleUpdate"
  />
</template>
