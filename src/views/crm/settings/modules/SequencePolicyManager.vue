<script setup lang="ts">
import SequencePolicyFormModal from './SequencePolicyFormModal.vue';
import SequencePolicyTable from './SequencePolicyTable.vue';
import SequencePolicyToolbar from './SequencePolicyToolbar.vue';
import { useSequencePolicyTable } from './useSequencePolicyTable';

const {
  canManage,
  editingPolicyId,
  filterModel,
  formModel,
  formVisible,
  handleArchiveSequencePolicy,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleSearch,
  handleSetDefaultSequencePolicy,
  handleSubmitSequencePolicy,
  loadSequencePolicies,
  loading,
  openCreateModal,
  openEditModal,
  operatingPolicyId,
  pagination,
  records,
  submitting
} = useSequencePolicyTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="序列策略库">
    <NSpace vertical :size="12">
      <SequencePolicyToolbar
        v-model="filterModel"
        :can-manage="canManage"
        :loading="loading"
        @add="openCreateModal"
        @refresh="loadSequencePolicies"
        @reset="handleReset"
        @search="handleSearch"
      />

      <SequencePolicyTable
        :records="records"
        :can-manage="canManage"
        :loading="loading"
        :operating-policy-id="operatingPolicyId"
        :page="pagination.current"
        :page-size="pagination.size"
        :total="pagination.total"
        @archive="handleArchiveSequencePolicy"
        @edit="openEditModal"
        @set-default="handleSetDefaultSequencePolicy"
        @update-page="handlePageUpdate"
        @update-page-size="handlePageSizeUpdate"
      />
    </NSpace>
  </NCard>

  <SequencePolicyFormModal
    v-model:visible="formVisible"
    v-model="formModel"
    :mode="editingPolicyId ? 'edit' : 'create'"
    :submitting="submitting"
    @submit="handleSubmitSequencePolicy"
    @update:visible="handleFormVisibleUpdate"
  />
</template>
