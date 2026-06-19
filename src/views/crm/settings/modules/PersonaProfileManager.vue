<script setup lang="ts">
import PersonaProfileFormModal from './PersonaProfileFormModal.vue';
import PersonaProfileTable from './PersonaProfileTable.vue';
import PersonaProfileToolbar from './PersonaProfileToolbar.vue';
import { usePersonaProfileTable } from './usePersonaProfileTable';

const {
  canManage,
  editingPersonaProfileId,
  filterModel,
  formModel,
  formVisible,
  handleArchivePersonaProfile,
  handleFormVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReset,
  handleSearch,
  handleSetDefaultPersonaProfile,
  handleSubmitPersonaProfile,
  loadPersonaProfiles,
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
    <NSpace vertical :size="12">
      <PersonaProfileToolbar
        v-model="filterModel"
        :can-manage="canManage"
        :loading="loading"
        @add="openCreateModal"
        @refresh="loadPersonaProfiles"
        @reset="handleReset"
        @search="handleSearch"
      />

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
    </NSpace>
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
