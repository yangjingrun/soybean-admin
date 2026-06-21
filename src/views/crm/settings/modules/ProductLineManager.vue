<script setup lang="ts">
import ProductLineFormModal from './ProductLineFormModal.vue';
import ProductLinePromptVersionDrawer from './ProductLinePromptVersionDrawer.vue';
import ProductLineTable from './ProductLineTable.vue';
import ProductLineToolbar from './ProductLineToolbar.vue';
import { useProductLineTable } from './useProductLineTable';

const {
  editingProductLineId,
  editingProductLineRecord,
  filterModel,
  formModel,
  formVisible,
  handleArchiveProductLine,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handlePromptHistoryVisibleUpdate,
  handlePromptVersionRestored,
  handleReset,
  handleSearch,
  handleSubmitProductLine,
  canManage,
  canManageAiWritingConfig,
  loadProductLines,
  loading,
  openCreateModal,
  openEditModal,
  openPromptHistoryDrawer,
  operatingProductLineId,
  pagination,
  promptHistoryVisible,
  records,
  submitting
} = useProductLineTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="产品线资料">
    <NSpace vertical :size="12">
      <ProductLineToolbar
        v-model="filterModel"
        :can-manage="canManage"
        :loading="loading"
        @add="openCreateModal"
        @refresh="loadProductLines"
        @reset="handleReset"
        @search="handleSearch"
      />

      <ProductLineTable
        :records="records"
        :can-manage="canManage"
        :loading="loading"
        :operating-product-line-id="operatingProductLineId"
        :page="pagination.current"
        :page-size="pagination.size"
        :total="pagination.total"
        @archive="handleArchiveProductLine"
        @edit="openEditModal"
        @update-page="handlePageUpdate"
        @update-page-size="handlePageSizeUpdate"
      />
    </NSpace>
  </NCard>

  <ProductLineFormModal
    v-model:visible="formVisible"
    v-model="formModel"
    :mode="editingProductLineId ? 'edit' : 'create'"
    :can-manage-ai-writing-config="canManageAiWritingConfig"
    :submitting="submitting"
    @open-prompt-history="openPromptHistoryDrawer"
    @submit="handleSubmitProductLine"
    @update:visible="handleFormVisibleUpdate"
  />

  <ProductLinePromptVersionDrawer
    v-model:visible="promptHistoryVisible"
    :product-line-id="editingProductLineId"
    :product-line-name="editingProductLineRecord?.name || formModel.name"
    :current-config="formModel.aiWritingConfig"
    :can-restore="canManageAiWritingConfig"
    @restored="handlePromptVersionRestored"
    @update:visible="handlePromptHistoryVisibleUpdate"
  />
</template>
