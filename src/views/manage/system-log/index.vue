<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue';
import { fetchSystemLogDetail, fetchSystemLogs } from '@/service/api';
import LogDetailDrawer from './modules/LogDetailDrawer.vue';
import LogTable from './modules/LogTable.vue';
import { buildSystemLogSearchParams, createDefaultFilterModel } from './modules/shared';

const records = shallowRef<Api.SystemLog.SystemLogRecord[]>([]);
const selectedLog = shallowRef<Api.SystemLog.SystemLogRecord | null>(null);

const loading = shallowRef(false);
const detailLoading = shallowRef(false);
const drawerVisible = shallowRef(false);

const pagination = reactive({
  current: 1,
  size: 10,
  total: 0
});

const filterModel = reactive<Api.SystemLog.SystemLogFilterModel>(createDefaultFilterModel());

onMounted(() => {
  void loadLogs();
});

/** Load system logs with createdAt desc ordering handled by backend. */
async function loadLogs() {
  loading.value = true;

  try {
    const { data, error } = await fetchSystemLogs(
      buildSystemLogSearchParams({
        current: pagination.current,
        size: pagination.size,
        filterModel
      })
    );

    if (error) {
      return;
    }

    records.value = data.records;
    pagination.current = data.current;
    pagination.size = data.size;
    pagination.total = data.total;
  } finally {
    loading.value = false;
  }
}

function handlePageUpdate(page: number) {
  pagination.current = page;
  void loadLogs();
}

function handlePageSizeUpdate(pageSize: number) {
  pagination.size = pageSize;
  pagination.current = 1;
  void loadLogs();
}

async function handleViewDetail(record: Api.SystemLog.SystemLogRecord) {
  detailLoading.value = true;
  selectedLog.value = record;
  drawerVisible.value = true;

  try {
    const { data, error } = await fetchSystemLogDetail(record.id);

    if (error) {
      return;
    }

    selectedLog.value = data;
  } finally {
    detailLoading.value = false;
  }
}
</script>

<template>
  <NSpace vertical :size="12">
    <LogTable
      :records="records"
      :loading="loading"
      :page="pagination.current"
      :page-size="pagination.size"
      :total="pagination.total"
      @view="handleViewDetail"
      @update-page="handlePageUpdate"
      @update-page-size="handlePageSizeUpdate"
    />

    <LogDetailDrawer v-model:show="drawerVisible" :record="selectedLog" :loading="detailLoading" />
  </NSpace>
</template>
