<script setup lang="ts">
import EmailTemplateFormModal from './EmailTemplateFormModal.vue';
import EmailTemplateTable from './EmailTemplateTable.vue';
import { useEmailTemplateTable } from './useEmailTemplateTable';

const {
  canManage,
  editingTemplateId,
  formModel,
  formVisible,
  handleArchiveEmailTemplate,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleSetDefaultEmailTemplate,
  handleSubmitEmailTemplate,
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
  <NCard :bordered="false" size="small" class="card-wrapper">
    <template #header-extra>
      <NButton v-if="canManage" size="small" type="primary" @click="openCreateModal">新增模板</NButton>
    </template>

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
