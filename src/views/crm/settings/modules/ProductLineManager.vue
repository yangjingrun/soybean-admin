<script setup lang="ts">
import ProductLineFormModal from './ProductLineFormModal.vue';
import ProductLineTable from './ProductLineTable.vue';
import ProductLineToolbar from './ProductLineToolbar.vue';
import { useProductLineTable } from './useProductLineTable';

const {
  editingProductLineId,
  filterModel,
  formModel,
  formVisible,
  handleArchiveProductLine,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleSearch,
  handleSubmitProductLine,
  canManageAiWritingConfig,
  loadProductLines,
  loading,
  openCreateModal,
  openEditModal,
  operatingProductLineId,
  pagination,
  records,
  submitting
} = useProductLineTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="产品线资料">
    <NSpace vertical :size="12">
      <ProductLineToolbar
        v-model="filterModel"
        :loading="loading"
        @add="openCreateModal"
        @refresh="loadProductLines"
        @reset="handleReset"
        @search="handleSearch"
      />

      <ProductLineTable
        :records="records"
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
    @submit="handleSubmitProductLine"
    @update:visible="handleFormVisibleUpdate"
  />
</template>
