<script setup lang="ts">
interface AiDraftDescriptionRow {
  key: string;
  label: string;
  value: string;
}

interface AiDraftReviewTag {
  key: string;
  label: string;
  type: NaiveUI.ThemeColor;
}

defineProps<{
  factRows: AiDraftDescriptionRow[];
  promptSnapshotRows: AiDraftDescriptionRow[];
  reviewTags: AiDraftReviewTag[];
  summaryRows: AiDraftDescriptionRow[];
}>();
</script>

<template>
  <NAlert title="AI 生成信息" type="warning" :bordered="false" class="status-alert">
    <NSpace vertical :size="10">
      <NDescriptions :column="1" bordered size="small" label-placement="left">
        <NDescriptionsItem v-for="row in summaryRows" :key="row.key" :label="row.label">
          <span class="ai-draft-text">{{ row.value }}</span>
        </NDescriptionsItem>
      </NDescriptions>

      <NSpace v-if="reviewTags.length" :size="6">
        <NTag v-for="tag in reviewTags" :key="tag.key" size="small" :type="tag.type" :bordered="false">
          {{ tag.label }}
        </NTag>
      </NSpace>

      <NDescriptions v-if="factRows.length" :column="1" bordered size="small" label-placement="left">
        <NDescriptionsItem v-for="row in factRows" :key="row.key" :label="row.label">
          <span class="ai-draft-text">{{ row.value }}</span>
        </NDescriptionsItem>
      </NDescriptions>

      <NCollapse v-if="promptSnapshotRows.length">
        <NCollapseItem title="Prompt 快照" name="prompt-snapshot">
          <NDescriptions :column="1" bordered size="small" label-placement="left">
            <NDescriptionsItem v-for="row in promptSnapshotRows" :key="row.key" :label="row.label">
              <pre class="ai-prompt-text">{{ row.value }}</pre>
            </NDescriptionsItem>
          </NDescriptions>
        </NCollapseItem>
      </NCollapse>
    </NSpace>
  </NAlert>
</template>

<style scoped>
.status-alert {
  margin-bottom: 10px;
}

.ai-draft-text {
  word-break: break-word;
}

.ai-prompt-text {
  margin: 0;
  color: var(--n-text-color-2);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
