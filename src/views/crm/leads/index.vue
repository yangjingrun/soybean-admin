<script setup lang="ts">
import FilterPanel from './modules/FilterPanel.vue';
import LeadStats from './modules/LeadStats.vue';
import LeadTable from './modules/LeadTable.vue';
import { useLeadTable } from './modules/shared/useLeadTable';

const { filterModel, handlePageSizeUpdate, handlePageUpdate, handleReset, handleSearch, loading, pagination, records } =
  useLeadTable();
</script>

<template>
  <NSpace vertical :size="12">
    <FilterPanel v-model="filterModel" :loading="loading" @search="handleSearch" @reset="handleReset" />

    <LeadStats :records="records" :total="pagination.total" />

    <LeadTable
      :records="records"
      :loading="loading"
      :page="pagination.current"
      :page-size="pagination.size"
      :total="pagination.total"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
    />
  </NSpace>
</template>
