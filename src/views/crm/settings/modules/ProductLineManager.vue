<script setup lang="ts">
import ProductLineFormDrawer from './ProductLineFormDrawer.vue';
import ProductLinePromptVersionDrawer from './ProductLinePromptVersionDrawer.vue';
import ProductLineTable from './ProductLineTable.vue';
import { useProductLineTable } from './useProductLineTable';

const {
  editingProductLineId,
  editingProductLineRecord,
  formModel,
  formVisible,
  handleArchiveProductLine,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handlePromptHistoryVisibleUpdate,
  handlePromptVersionRestored,
  handleSubmitProductLine,
  canManage,
  canManageAiWritingConfig,
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
    <template #header-extra>
      <NButton v-if="canManage" size="small" type="primary" @click="openCreateModal">新增产品线</NButton>
    </template>

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
  </NCard>

  <ProductLineFormDrawer
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
