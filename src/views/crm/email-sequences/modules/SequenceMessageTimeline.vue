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
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.message-step-button {
  display: flex;
  min-width: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  color: var(--n-text-color);
  cursor: pointer;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  text-align: left;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.message-step-button:hover,
.message-step-button--selected {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 1px var(--n-primary-color);
}

.message-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
  color: var(--n-text-color-2);
  font-size: 12px;
}

.message-step-meta {
  color: var(--n-text-color-3);
  font-size: 12px;
}
</style>
