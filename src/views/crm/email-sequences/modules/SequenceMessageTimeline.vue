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
  padding: 2px 2px 4px;
}

.message-step-button {
  position: relative;
  display: grid;
  overflow: hidden;
  width: 190px;
  min-width: 190px;
  appearance: none;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: rgb(var(--container-bg-color));
  color: rgb(var(--base-text-color));
  cursor: pointer;
  font: inherit;
  gap: 4px;
  padding: 9px 10px 9px 14px;
  text-align: left;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.message-step-button::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 7px;
  width: 3px;
  border-radius: 999px;
  background: rgb(var(--primary-color));
  content: '';
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-step-button:hover {
  border-color: rgb(var(--primary-color) / 0.32);
  background: rgb(var(--primary-color) / 0.045);
}

.message-step-button:focus-visible {
  outline: 2px solid rgb(var(--primary-color) / 0.45);
  outline-offset: 2px;
}

.message-step-button--selected {
  border-color: rgb(var(--primary-color) / 0.48);
  background: linear-gradient(90deg, rgb(var(--primary-color) / 0.1), rgb(var(--primary-color) / 0.035));
  box-shadow: 0 0 0 1px rgb(var(--primary-color) / 0.2);
}

.message-step-button--selected::before {
  opacity: 1;
}

.message-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.message-step-title,
.message-step-subject {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-step-title {
  color: rgb(var(--base-text-color));
  font-size: 13px;
  font-weight: 600;
}

.message-step-button--selected .message-step-title {
  color: rgb(var(--primary-color));
}

.message-step-subject {
  color: rgb(var(--base-text-color) / 0.72);
  font-size: 12px;
}

.message-step-meta {
  display: none;
  color: rgb(var(--base-text-color) / 0.52);
  font-size: 12px;
}
</style>
