<script setup lang="ts">
import type { DraftVersionDiffSummary, DraftVersionListItem } from './shared';

export interface DraftVersionPreviewItem extends DraftVersionListItem {
  diff: DraftVersionDiffSummary | null;
  record: Api.Crm.MessageDraftVersionRecord | null;
  selected: boolean;
}

defineProps<{
  activePreview: DraftVersionPreviewItem | null;
  canEdit: boolean;
  items: DraftVersionPreviewItem[];
  loading?: boolean;
  restoring?: boolean;
}>();

const emit = defineEmits<{
  hover: [versionId: string | null];
  restore: [versionId: string];
  select: [versionId: string];
}>();
</script>

<template>
  <div class="drawer-section">
    <div class="section-title">历史版本</div>
    <NSpin :show="loading">
      <NSpace v-if="items.length" vertical :size="8">
        <div
          v-for="version in items"
          :key="version.id"
          class="draft-version-row"
          :class="{ 'draft-version-row--selected': version.selected }"
          role="button"
          tabindex="0"
          @click="emit('select', version.id)"
          @keydown.enter.prevent="emit('select', version.id)"
          @mouseenter="emit('hover', version.id)"
          @mouseleave="emit('hover', null)"
        >
          <div class="draft-version-main">
            <NSpace align="center" :size="8">
              <NTag size="small" :bordered="false" type="info">{{ version.versionLabel }}</NTag>
              <span class="draft-version-time">{{ version.createdAtText }}</span>
            </NSpace>
            <div class="draft-version-subject">{{ version.subjectSummary }}</div>
            <div class="draft-version-diff">{{ version.diff?.summaryText }}</div>
            <div class="draft-version-editor">编辑人：{{ version.editorName }}</div>
          </div>
          <NPopconfirm positive-text="恢复" negative-text="取消" @positive-click="emit('restore', version.id)">
            <template #trigger>
              <NButton size="small" secondary :disabled="!canEdit || restoring" :loading="restoring">恢复</NButton>
            </template>
            <div class="restore-confirm">
              <div>恢复后会覆盖当前待审草稿内容。</div>
              <div class="restore-confirm-diff">{{ version.diff?.summaryText }}</div>
              <div class="restore-confirm-label">将恢复主题</div>
              <div class="restore-confirm-subject">{{ version.record?.subject || '-' }}</div>
              <div class="restore-confirm-label">将恢复正文</div>
              <pre class="restore-confirm-body">{{ version.record?.bodyText || '-' }}</pre>
            </div>
          </NPopconfirm>
        </div>
        <div v-if="activePreview" class="draft-version-preview">
          <div class="draft-version-preview-header">
            <span>{{ activePreview.versionLabel }} 对比当前草稿</span>
            <NTag size="small" :bordered="false" :type="activePreview.diff?.hasChanges ? 'warning' : 'success'">
              {{ activePreview.diff?.summaryText }}
            </NTag>
          </div>
          <div v-if="activePreview.diff?.previewLines.length" class="draft-version-preview-lines">
            <span v-for="line in activePreview.diff.previewLines" :key="line">{{ line }}</span>
          </div>
          <div class="draft-version-preview-label">恢复后主题</div>
          <div class="draft-version-preview-subject">
            {{ activePreview.record?.subject || '-' }}
          </div>
          <div class="draft-version-preview-label">恢复后正文</div>
          <pre class="draft-version-preview-body">{{ activePreview.record?.bodyText || '-' }}</pre>
        </div>
      </NSpace>
      <NEmpty v-else description="暂无历史版本" />
    </NSpin>
  </div>
</template>

<style scoped>
.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.draft-version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.draft-version-row:hover,
.draft-version-row--selected {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 1px var(--n-primary-color);
}

.draft-version-main {
  min-width: 0;
}

.draft-version-time,
.draft-version-editor {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.draft-version-subject {
  overflow: hidden;
  margin-top: 6px;
  color: var(--n-text-color-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-version-diff {
  margin-top: 4px;
  color: var(--n-warning-color);
  font-size: 12px;
}

.draft-version-preview {
  display: flex;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-table-color);
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.draft-version-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 600;
}

.draft-version-preview-lines {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--n-text-color-2);
  font-size: 12px;
}

.draft-version-preview-label,
.restore-confirm-label {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.draft-version-preview-subject,
.restore-confirm-subject {
  color: var(--n-text-color);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.draft-version-preview-body,
.restore-confirm-body {
  overflow: auto;
  max-height: 180px;
  margin: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  background: var(--n-color);
  color: var(--n-text-color-2);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  padding: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.restore-confirm {
  display: flex;
  width: 320px;
  max-width: 70vw;
  flex-direction: column;
  gap: 6px;
}

.restore-confirm-diff {
  color: var(--n-warning-color);
  font-size: 12px;
}
</style>
