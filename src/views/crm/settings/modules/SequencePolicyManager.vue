<script setup lang="ts">
import SequencePolicyFormModal from './SequencePolicyFormModal.vue';
import SequencePolicyTable from './SequencePolicyTable.vue';
import { useSequencePolicyTable } from './useSequencePolicyTable';

const {
  canManage,
  editingPolicyId,
  formModel,
  formVisible,
  handleArchiveSequencePolicy,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleSetDefaultSequencePolicy,
  handleSubmitSequencePolicy,
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
    <template #header-extra>
      <NButton v-if="canManage" size="small" type="primary" @click="openCreateModal">新建策略</NButton>
    </template>

    <NSpace vertical :size="12">
      <NText depth="3">
        序列策略 = 自定义跟进节奏（每封间隔几天、是否同线程等）。默认按 5 步跟进已经够用，想自定义再新建。
      </NText>

      <SequencePolicyTable
        :records="records"
        :can-manage="canManage"
        :loading="loading"
        :operating-policy-id="operatingPolicyId"
        :page="pagination.current"
        :page-size="pagination.size"
        :total="pagination.total"
        @add="openCreateModal"
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
