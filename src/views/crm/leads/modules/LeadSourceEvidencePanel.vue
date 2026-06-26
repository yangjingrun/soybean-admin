<script setup lang="ts">
import { computed } from 'vue';
import type { LeadWebsiteEvidenceView } from './shared';

const props = defineProps<{
  evidence: LeadWebsiteEvidenceView;
}>();

const hasWebsiteContactEvidence = computed(
  () =>
    props.evidence.emails.length > 0 ||
    props.evidence.phones.length > 0 ||
    props.evidence.socialLinks.length > 0 ||
    props.evidence.contactLinks.length > 0 ||
    props.evidence.mapLinks.length > 0
);

const hasKeywordEvidence = computed(
  () =>
    props.evidence.keywordHits.length > 0 ||
    props.evidence.evidenceSnippets.length > 0 ||
    props.evidence.negativeKeywordHits.length > 0 ||
    props.evidence.negativeEvidenceSnippets.length > 0
);

function formatOptionalText(value: string) {
  return value || '-';
}

function formatOptionalNumber(value: number | null) {
  return value === null ? '-' : String(value);
}
</script>

<template>
  <div class="lead-source-evidence">
    <div class="detail-section-header">
      <div>
        <div class="section-title">官网深度采集</div>
        <div class="section-subtitle">展示 AI 获客导入时保存的原始官网证据和精准度判断。</div>
      </div>
      <NSpace align="center" :size="8" wrap>
        <NTag :type="evidence.crawlStatusTagType" :bordered="false" size="small">
          {{ evidence.crawlStatusLabel }}
        </NTag>
        <NTag v-if="evidence.pageCount !== null" :bordered="false" size="small" type="info">
          {{ evidence.pageCount }} 页
        </NTag>
      </NSpace>
    </div>

    <NEmpty v-if="!evidence.hasSnapshot" description="暂无官网采集原始数据" />

    <template v-else>
      <div class="evidence-grid">
        <NDescriptions :column="1" label-placement="left" bordered size="small">
          <NDescriptionsItem label="来源 URL">
            <a v-if="evidence.sourceUrl" :href="evidence.sourceUrl" target="_blank" rel="noopener noreferrer">
              {{ evidence.sourceUrl }}
            </a>
            <span v-else>-</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="官网">
            <a v-if="evidence.sourceWebsite" :href="evidence.sourceWebsite" target="_blank" rel="noopener noreferrer">
              {{ evidence.sourceWebsite }}
            </a>
            <span v-else>-</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="最终页面">
            <a v-if="evidence.finalUrl" :href="evidence.finalUrl" target="_blank" rel="noopener noreferrer">
              {{ evidence.finalUrl }}
            </a>
            <span v-else>-</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="页面标题">{{ formatOptionalText(evidence.title) }}</NDescriptionsItem>
          <NDescriptionsItem label="页面描述">{{ formatOptionalText(evidence.description) }}</NDescriptionsItem>
          <NDescriptionsItem label="来源摘要">{{ formatOptionalText(evidence.sourceSnippet) }}</NDescriptionsItem>
          <NDescriptionsItem label="来源分数">{{ formatOptionalNumber(evidence.sourceScore) }}</NDescriptionsItem>
          <NDescriptionsItem label="来源原因">{{ formatOptionalText(evidence.sourceReason) }}</NDescriptionsItem>
          <NDescriptionsItem label="失败原因">{{ formatOptionalText(evidence.failureReason) }}</NDescriptionsItem>
        </NDescriptions>

        <div class="evidence-side">
          <div class="evidence-panel">
            <div class="evidence-panel-title">AI 精准度判断</div>
            <NEmpty v-if="!evidence.precisionAnalysis" description="暂无精准度判断" />
            <template v-else>
              <NSpace :size="8" wrap>
                <NTag :type="evidence.precisionAnalysis.priorityTagType" :bordered="false" size="small">
                  {{ evidence.precisionAnalysis.priority || '未分级' }}
                </NTag>
                <NTag v-if="evidence.precisionAnalysis.score !== null" type="info" :bordered="false" size="small">
                  {{ evidence.precisionAnalysis.score }} 分
                </NTag>
                <NTag v-if="evidence.precisionAnalysis.reviewRequired" type="warning" :bordered="false" size="small">
                  需复核
                </NTag>
              </NSpace>
              <div class="evidence-text">{{ formatOptionalText(evidence.precisionAnalysis.buyerType) }}</div>
              <div class="evidence-muted">{{ formatOptionalText(evidence.precisionAnalysis.reason) }}</div>
              <div v-if="evidence.precisionAnalysis.recommendedAction" class="evidence-action">
                {{ evidence.precisionAnalysis.recommendedAction }}
              </div>
            </template>
          </div>

          <div class="evidence-panel">
            <div class="evidence-panel-title">官网联系方式</div>
            <NEmpty v-if="!hasWebsiteContactEvidence" description="官网未采集到联系方式" />
            <template v-else>
              <div v-if="evidence.emails.length" class="evidence-line">
                <span class="evidence-label">邮箱</span>
                <NTag v-for="email in evidence.emails" :key="email" size="small" :bordered="false">
                  {{ email }}
                </NTag>
              </div>
              <div v-if="evidence.phones.length" class="evidence-line">
                <span class="evidence-label">电话</span>
                <NTag v-for="phone in evidence.phones" :key="phone" size="small" :bordered="false">
                  {{ phone }}
                </NTag>
              </div>
              <div v-if="evidence.socialLinks.length" class="evidence-line">
                <span class="evidence-label">社媒</span>
                <a
                  v-for="link in evidence.socialLinks"
                  :key="link.url"
                  class="evidence-social-link"
                  :class="`social-brand-link--${link.channel}`"
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="`打开 ${link.label}`"
                >
                  <SvgIcon :icon="link.icon" class="evidence-social-icon" />
                </a>
              </div>
              <div v-if="evidence.contactLinks.length" class="evidence-link-list">
                <span class="evidence-label">联系页</span>
                <a
                  v-for="link in evidence.contactLinks"
                  :key="link"
                  :href="link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ link }}
                </a>
              </div>
              <div v-if="evidence.mapLinks.length" class="evidence-link-list">
                <span class="evidence-label">地图</span>
                <a
                  v-for="link in evidence.mapLinks"
                  :key="link"
                  :href="link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ link }}
                </a>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="evidence-panel">
        <div class="evidence-panel-title">关键词与页面证据</div>
        <NEmpty v-if="!hasKeywordEvidence" description="暂无关键词和页面片段" />
        <template v-else>
          <div v-if="evidence.keywordHits.length" class="evidence-line">
            <span class="evidence-label">命中词</span>
            <NTag v-for="keyword in evidence.keywordHits" :key="keyword" size="small" type="success" :bordered="false">
              {{ keyword }}
            </NTag>
          </div>
          <div v-if="evidence.negativeKeywordHits.length" class="evidence-line">
            <span class="evidence-label">负面词</span>
            <NTag
              v-for="keyword in evidence.negativeKeywordHits"
              :key="keyword"
              size="small"
              type="warning"
              :bordered="false"
            >
              {{ keyword }}
            </NTag>
          </div>
          <div v-if="evidence.evidenceSnippets.length" class="snippet-list">
            <div v-for="snippet in evidence.evidenceSnippets" :key="snippet" class="snippet-item">
              {{ snippet }}
            </div>
          </div>
          <div v-if="evidence.negativeEvidenceSnippets.length" class="snippet-list">
            <div
              v-for="snippet in evidence.negativeEvidenceSnippets"
              :key="snippet"
              class="snippet-item snippet-item--warning"
            >
              {{ snippet }}
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lead-source-evidence,
.evidence-side,
.evidence-panel,
.snippet-list,
.evidence-link-list {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lead-source-evidence {
  gap: 12px;
}

.detail-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.evidence-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
}

.evidence-side {
  gap: 12px;
}

.evidence-panel {
  gap: 8px;
  min-height: 0;
}

.evidence-panel-title {
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 600;
}

.evidence-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.evidence-label {
  flex: 0 0 auto;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.evidence-text {
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 500;
}

.evidence-muted,
.evidence-action {
  color: var(--n-text-color-2);
  font-size: 12px;
  line-height: 1.55;
}

.evidence-action {
  color: rgb(var(--primary-color));
}

.evidence-social-link {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--social-brand-border, var(--n-border-color));
  border-radius: 6px;
  color: var(--social-brand-color, var(--n-text-color-2));
  background: var(--social-brand-bg, var(--n-color));
  text-decoration: none;
}

.evidence-social-icon {
  font-size: 14px;
}

.evidence-link-list {
  gap: 4px;
}

.evidence-link-list a,
.lead-source-evidence :deep(.n-descriptions-table-content a) {
  overflow-wrap: anywhere;
}

.snippet-list {
  gap: 6px;
}

.snippet-item {
  border-left: 3px solid rgb(var(--primary-color) / 0.36);
  color: var(--n-text-color-2);
  font-size: 12px;
  line-height: 1.55;
  padding-left: 8px;
}

.snippet-item--warning {
  border-left-color: var(--n-warning-color);
}

@media (max-width: 960px) {
  .evidence-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
