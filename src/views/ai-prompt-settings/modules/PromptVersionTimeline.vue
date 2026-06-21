<script setup lang="ts">
import dayjs from 'dayjs';

defineProps<{
  versions: Api.AiGateway.AiPromptVersionRecord[];
  rollingBackVersionId?: string | null;
}>();

const emit = defineEmits<{
  rollback: [version: Api.AiGateway.AiPromptVersionRecord];
}>();

function formatDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未记录';
}
</script>

<template>
  <div class="version-panel">
    <div class="version-panel__content">
      <div class="version-panel__header">
        <div>
          <p class="version-panel__desc">发布后可从这里回滚</p>
        </div>
        <NTag size="small" :bordered="false">{{ versions.length }} 条</NTag>
      </div>

      <NEmpty v-if="versions.length === 0" description="暂无历史版本" size="small" />
      <NScrollbar v-else class="version-panel__scroll">
        <div class="version-panel__list">
          <div v-for="version in versions" :key="version.id" class="version-panel__item">
            <div class="version-panel__item-main">
              <NTag size="small" type="primary" :bordered="false">v{{ version.version }}</NTag>
              <div class="version-panel__item-copy">
                <div class="version-panel__item-title">{{ version.changeNote || '未填写变更说明' }}</div>
                <div class="version-panel__item-meta">
                  {{ version.createdByName || '未知' }} · {{ formatDate(version.publishedAt || version.createdAt) }}
                </div>
              </div>
            </div>
            <div class="version-panel__item-action">
              <NButton
                size="tiny"
                secondary
                :loading="rollingBackVersionId === version.id"
                :disabled="Boolean(rollingBackVersionId)"
                @click="emit('rollback', version)"
              >
                回滚
              </NButton>
            </div>
          </div>
        </div>
      </NScrollbar>
    </div>
  </div>
</template>

<style scoped>
.version-panel__content {
  display: grid;
  gap: 12px;
}

.version-panel__header,
.version-panel__item-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.version-panel__header {
  justify-content: space-between;
}

.version-panel__desc {
  margin: 0;
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  line-height: 1.4;
}

.version-panel__scroll {
  max-height: 232px;
}

.version-panel__list {
  display: grid;
  gap: 8px;
}

.version-panel__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--prompt-workbench-border);
  border-radius: 6px;
  background: var(--prompt-workbench-muted);
}

.version-panel__item-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.version-panel__item-title {
  overflow: hidden;
  color: var(--prompt-workbench-ink);
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-panel__item-meta {
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  line-height: 1.4;
}

.version-panel__item-action {
  align-self: center;
}
</style>
