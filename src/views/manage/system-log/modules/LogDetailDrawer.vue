<script setup lang="ts">
import { computed } from 'vue';
import { useMessage } from 'naive-ui';
import {
  formatLogDate,
  formatMetadata,
  logLevelLabelMap,
  logLevelTagTypeMap,
  logStatusLabelMap,
  logStatusTagTypeMap,
  readMetadataString
} from './shared';

const props = defineProps<{
  show: boolean;
  record: Api.SystemLog.SystemLogRecord | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
}>();

const message = useMessage();

const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});

const metadataCode = computed(() => formatMetadata(props.record?.metadata ?? null));
const requestId = computed(() => readMetadataString(props.record?.metadata ?? null, 'requestId'));
const ip = computed(() => readMetadataString(props.record?.metadata ?? null, 'ip'));
const userAgent = computed(() => readMetadataString(props.record?.metadata ?? null, 'userAgent'));

/** Copy troubleshooting text for developers and super admins. */
async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  message.success(`${label}已复制`);
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="560" placement="right">
    <NDrawerContent title="日志详情" closable>
      <NSpin :show="loading">
        <NSpace v-if="record" vertical :size="16">
          <div class="log-summary">
            <NSpace :size="8">
              <NTag :type="logLevelTagTypeMap[record.level]" :bordered="false" size="small">
                {{ logLevelLabelMap[record.level] }}
              </NTag>
              <NTag :type="logStatusTagTypeMap[record.status]" :bordered="false" size="small">
                {{ logStatusLabelMap[record.status] }}
              </NTag>
            </NSpace>
            <div class="summary-title">{{ record.module }} / {{ record.action }}</div>
            <div class="summary-message">{{ record.message }}</div>
          </div>

          <div class="drawer-section">
            <div class="section-title">基础信息</div>
            <NDescriptions :column="1" label-placement="left" bordered size="small">
              <NDescriptionsItem label="时间">{{ formatLogDate(record.createdAt) }}</NDescriptionsItem>
              <NDescriptionsItem label="操作人">{{ record.userName || record.userId || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="模块">{{ record.module }}</NDescriptionsItem>
              <NDescriptionsItem label="动作">{{ record.action }}</NDescriptionsItem>
            </NDescriptions>
          </div>

          <div class="drawer-section">
            <div class="section-title">请求上下文</div>
            <NDescriptions :column="1" label-placement="left" bordered size="small">
              <NDescriptionsItem label="请求 ID">
                <NSpace align="center" :size="6">
                  <span>{{ requestId }}</span>
                  <NButton
                    v-if="requestId !== '-'"
                    size="tiny"
                    text
                    type="primary"
                    @click="copyText(requestId, '请求 ID')"
                  >
                    <template #icon>
                      <SvgIcon icon="material-symbols:content-copy-outline" />
                    </template>
                    复制
                  </NButton>
                </NSpace>
              </NDescriptionsItem>
              <NDescriptionsItem label="IP">{{ ip }}</NDescriptionsItem>
              <NDescriptionsItem label="User Agent">{{ userAgent }}</NDescriptionsItem>
            </NDescriptions>
          </div>

          <NAlert v-if="record.errorCode || record.errorMessage" title="错误信息" type="error" :bordered="false">
            <NSpace vertical :size="4">
              <div v-if="record.errorCode">错误码：{{ record.errorCode }}</div>
              <div v-if="record.errorMessage">{{ record.errorMessage }}</div>
            </NSpace>
          </NAlert>

          <div class="drawer-section">
            <div class="section-heading">
              <div class="section-title">Metadata</div>
              <NButton v-if="metadataCode" size="tiny" text type="primary" @click="copyText(metadataCode, 'Metadata')">
                <template #icon>
                  <SvgIcon icon="material-symbols:content-copy-outline" />
                </template>
                复制
              </NButton>
            </div>
            <div class="metadata-block">
              <NCode v-if="metadataCode" :code="metadataCode" language="json" word-wrap />
              <NEmpty v-else description="无 metadata" />
            </div>
          </div>
        </NSpace>
        <NEmpty v-else description="请选择日志" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.log-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 14px;
}

.summary-title {
  color: var(--n-text-color);
  font-size: 16px;
  font-weight: 600;
}

.summary-message {
  color: var(--n-text-color-2);
  line-height: 1.6;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.metadata-block {
  background: var(--n-color-embedded);
  border-radius: 6px;
  padding: 12px;
}
</style>
