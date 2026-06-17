<script setup lang="ts">
import { computed } from 'vue';
import {
  formatLogDate,
  formatMetadata,
  getMetadataString,
  logLevelLabelMap,
  logLevelTagTypeMap,
  logStatusLabelMap,
  logStatusTagTypeMap
} from './shared';

const props = defineProps<{
  show: boolean;
  record: Api.SystemLog.SystemLogRecord | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
}>();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const metadataCode = computed(() => formatMetadata(props.record?.metadata ?? null));
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="520" placement="right">
    <NDrawerContent title="日志详情" closable>
      <NSpin :show="loading">
        <NSpace v-if="record" vertical :size="16">
          <NDescriptions :column="1" label-placement="left" bordered size="small">
            <NDescriptionsItem label="时间">{{ formatLogDate(record.createdAt) }}</NDescriptionsItem>
            <NDescriptionsItem label="等级">
              <NTag :type="logLevelTagTypeMap[record.level]" :bordered="false" size="small">
                {{ logLevelLabelMap[record.level] }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="状态">
              <NTag :type="logStatusTagTypeMap[record.status]" :bordered="false" size="small">
                {{ logStatusLabelMap[record.status] }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="模块">{{ record.module }}</NDescriptionsItem>
            <NDescriptionsItem label="动作">{{ record.action }}</NDescriptionsItem>
            <NDescriptionsItem label="用户">{{ record.userName || record.userId || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="IP">{{ getMetadataString(record.metadata, 'ip') }}</NDescriptionsItem>
            <NDescriptionsItem label="User Agent">
              {{ getMetadataString(record.metadata, 'userAgent') }}
            </NDescriptionsItem>
            <NDescriptionsItem label="消息">{{ record.message }}</NDescriptionsItem>
            <NDescriptionsItem v-if="record.errorCode" label="错误码">{{ record.errorCode }}</NDescriptionsItem>
            <NDescriptionsItem v-if="record.errorMessage" label="错误信息">
              {{ record.errorMessage }}
            </NDescriptionsItem>
          </NDescriptions>

          <NCard title="Metadata" size="small" :bordered="false" class="metadata-card">
            <NCode v-if="metadataCode" :code="metadataCode" language="json" word-wrap />
            <NEmpty v-else description="无 metadata" />
          </NCard>
        </NSpace>
        <NEmpty v-else description="请选择日志" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.metadata-card {
  background: var(--n-color-embedded);
}
</style>
