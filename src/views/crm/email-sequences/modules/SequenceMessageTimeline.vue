<script setup lang="ts">
import type { SequenceMessageTimelineItem } from './shared';

defineProps<{
  items: SequenceMessageTimelineItem[];
}>();

const emit = defineEmits<{
  select: [messageId: string];
}>();
</script>

<template>
  <div class="message-timeline">
    <button
      v-for="timelineItem in items"
      :key="timelineItem.id"
      type="button"
      class="message-step-button"
      :class="{ 'message-step-button--selected': timelineItem.selected }"
      @click="emit('select', timelineItem.id)"
    >
      <span class="message-step-header">
        <span class="message-step-title">{{ timelineItem.title }}</span>
        <NTag :type="timelineItem.statusTagType" :bordered="false" size="small">
          {{ timelineItem.statusLabel }}
        </NTag>
      </span>
      <span class="message-step-subject">{{ timelineItem.subject }}</span>
      <span class="message-step-meta">{{ timelineItem.metaText }}</span>
    </button>
  </div>
</template>

<style scoped>
.message-timeline {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 2px;
}

.message-step-button {
  display: flex;
  width: 150px;
  min-width: 150px;
  border: 1px solid var(--n-border-color);
  border-radius: 999px;
  background: var(--n-color);
  color: var(--n-text-color);
  cursor: pointer;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  text-align: left;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.message-step-button:hover,
.message-step-button--selected {
  border-color: var(--n-primary-color);
  background: rgba(99, 102, 241, 0.08);
  box-shadow: 0 0 0 1px var(--n-primary-color);
}

.message-step-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.message-step-title,
.message-step-subject {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-step-title {
  font-size: 13px;
  font-weight: 600;
}

.message-step-subject {
  flex: 1;
  color: var(--n-text-color-2);
  font-size: 12px;
}

.message-step-meta {
  display: none;
  color: var(--n-text-color-3);
  font-size: 12px;
}
</style>
