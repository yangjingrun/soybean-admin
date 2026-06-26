<script setup lang="ts">
import PersonaProfileFormModal from './PersonaProfileFormModal.vue';
import PersonaProfileTable from './PersonaProfileTable.vue';
import { usePersonaProfileTable } from './usePersonaProfileTable';

const {
  canManage,
  editingPersonaProfileId,
  formModel,
  formVisible,
  handleArchivePersonaProfile,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleSetDefaultPersonaProfile,
  handleSubmitPersonaProfile,
  loading,
  openCreateModal,
  openEditModal,
  operatingPersonaProfileId,
  pagination,
  records,
  submitting
} = usePersonaProfileTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="职位/客户画像库">
    <template #header-extra>
      <NButton v-if="canManage" size="small" type="primary" @click="openCreateModal">新增画像</NButton>
    </template>

    <PersonaProfileTable
      :records="records"
      :loading="loading"
      :can-manage="canManage"
      :operating-persona-profile-id="operatingPersonaProfileId"
      :page="pagination.current"
      :page-size="pagination.size"
      :total="pagination.total"
      @archive="handleArchivePersonaProfile"
      @edit="openEditModal"
      @set-default="handleSetDefaultPersonaProfile"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
    />
  </NCard>

  <PersonaProfileFormModal
    v-model:visible="formVisible"
    v-model="formModel"
    :mode="editingPersonaProfileId ? 'edit' : 'create'"
    :submitting="submitting"
    @submit="handleSubmitPersonaProfile"
    @update:visible="handleFormVisibleUpdate"
  />
</template>
