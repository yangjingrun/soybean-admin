<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import SendAuditPanel from './SendAuditPanel.vue';
import {
  formatNullableText,
  formatSequenceDate,
  buildDraftReviewOperationPayload,
  buildDraftVersionDiffSummary,
  buildDraftVersionListItems,
  buildSequenceMessageTimelineItems,
  buildSequencePolicyReviewHints,
  canGenerateNextSequenceDraft,
  type DraftReviewApprovePayload,
  type DraftReviewSavePayload,
  messageStatusLabelMap,
  messageStatusTagTypeMap,
  sequenceStatusLabelMap,
  sequenceStatusTagTypeMap
} from './shared';

const props = defineProps<{
  approving?: boolean;
  item: Api.Crm.SequenceReviewItem | null;
  loading?: boolean;
  nextDraftGenerating?: boolean;
  refreshing?: boolean;
  saving?: boolean;
  sendStarting?: boolean;
  show: boolean;
  stopping?: boolean;
  versionLoading?: boolean;
  versionRestoring?: boolean;
  versions?: Api.Crm.MessageDraftVersionRecord[];
}>();

const emit = defineEmits<{
  approveDraft: [payload: DraftReviewApprovePayload];
  generateNextDraft: [];
  loadDraftVersions: [messageId: string | null];
  refresh: [];
  restoreDraftVersion: [payload: { messageId: string; versionId: string }];
  saveDraft: [payload: DraftReviewSavePayload];
  startSend: [];
  stop: [];
  'update:show': [show: boolean];
}>();

const message = useMessage();
const drawerVisible = computed({
  get: () => props.show,
  set: value => emit('update:show', value)
});
const draftForm = reactive<Api.Crm.MessageDraftPayload>({
  subject: '',
  bodyText: ''
});
const selectedMessageId = shallowRef<string | null>(null);
const reviewMessages = computed(() => {
  if (props.item?.messages.length) return props.item.messages;
  return props.item?.firstMessage ? [props.item.firstMessage] : [];
});
const currentMessage = computed(
  () => reviewMessages.value.find(item => item.id === selectedMessageId.value) ?? reviewMessages.value[0] ?? null
);
const timelineItems = computed(() => buildSequenceMessageTimelineItems(reviewMessages.value, selectedMessageId.value));
const isFirstMessageSelected = computed(() => currentMessage.value?.stepIndex === 1);
const operableFollowUpEnrollmentStatuses: Api.Crm.SequenceEnrollmentStatus[] = ['ready_to_send', 'sequence_running'];
const canOperateSelectedDraft = computed(() =>
  Boolean(
    props.item?.canOperateDraft &&
    currentMessage.value?.status === 'draft_pending_review' &&
    (isFirstMessageSelected.value || operableFollowUpEnrollmentStatuses.includes(props.item.enrollment.status))
  )
);
const canEdit = computed(() => {
  return canOperateSelectedDraft.value;
});
const canApprove = computed(() => canOperateSelectedDraft.value);
const draftVersionItems = computed(() => buildDraftVersionListItems(props.versions ?? []));
const selectedDraftVersionId = shallowRef<string | null>(null);
const hoveredDraftVersionId = shallowRef<string | null>(null);
const draftVersionRecordMap = computed(() => {
  return new Map((props.versions ?? []).map(version => [version.id, version]));
});
const activeDraftVersionId = computed(
  () => hoveredDraftVersionId.value ?? selectedDraftVersionId.value ?? draftVersionItems.value[0]?.id ?? null
);
const draftVersionPreviewItems = computed(() =>
  draftVersionItems.value.map(version => {
    const record = draftVersionRecordMap.value.get(version.id);

    return {
      ...version,
      diff: record
        ? buildDraftVersionDiffSummary(
            {
              subject: draftForm.subject,
              bodyText: draftForm.bodyText
            },
            record
          )
        : null,
      record: record ?? null,
      selected: version.id === activeDraftVersionId.value
    };
  })
);
const activeDraftVersionPreview = computed(
  () => draftVersionPreviewItems.value.find(version => version.id === activeDraftVersionId.value) ?? null
);
const canStartSend = computed(() =>
  Boolean(
    props.item?.canOperateDraft &&
    isFirstMessageSelected.value &&
    props.item.enrollment.status === 'ready_to_send' &&
    currentMessage.value?.status === 'draft_ready'
  )
);
const canGenerateNextDraft = computed(() => Boolean(props.item && canGenerateNextSequenceDraft(props.item)));
const policyReviewHints = computed(() =>
  props.item ? buildSequencePolicyReviewHints(props.item, currentMessage.value) : []
);
const aiDraftInfo = computed(() => currentMessage.value?.aiDraft ?? null);
const aiDraftRiskNotes = computed(() => aiDraftInfo.value?.riskNotes ?? []);
const personaMatchMethodLabelMap: Record<Api.Crm.PersonaMatchMethod, string> = {
  title: '职位关键词',
  customer_type: '客户类型关键词',
  default: '默认画像',
  builtin: '内置画像',
  none: '未匹配'
};
const personaMatchSourceLabelMap: Record<Api.Crm.PersonaMatchSource, string> = {
  organization: '组织画像',
  builtin: '内置画像'
};
const personaMatchRows = computed(() => {
  const match = props.item?.personaMatch;

  if (!match) return [];

  return [
    {
      key: 'persona',
      label: '使用画像',
      value: match.persona
        ? `${match.persona.name}（${personaMatchSourceLabelMap[match.persona.source]}）`
        : '通用开发信'
    },
    {
      key: 'method',
      label: '匹配方式',
      value: personaMatchMethodLabelMap[match.matchMethod]
    },
    {
      key: 'keywords',
      label: '命中关键词',
      value: match.matchedKeywords.length ? match.matchedKeywords.join('、') : '-'
    },
    {
      key: 'reason',
      label: '使用原因',
      value: match.fallbackReason || '命中关键词后使用该画像生成草稿'
    }
  ];
});
const canRefreshSequence = computed(() =>
  Boolean(props.item && ['sequence_running', 'paused', 'stopped'].includes(props.item.enrollment.status))
);
const canStopSequence = computed(() =>
  Boolean(
    props.item?.canControlSequence &&
    ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'].includes(props.item.enrollment.status)
  )
);
const statusTip = computed(() => {
  if (props.item?.enrollment.status === 'stopped') return '序列已停止，旧发送任务会在执行前跳过';
  if (!currentMessage.value) return '暂无草稿';
  if (!isFirstMessageSelected.value && currentMessage.value.status === 'draft_pending_review')
    return '确认后会按计划时间进入发送队列';
  if (currentMessage.value.status === 'draft_pending_review') return '草稿待人工确认后才能进入发送队列';
  if (currentMessage.value.status === 'draft_ready') return '草稿已确认，可以启动首封发送';
  if (currentMessage.value.status === 'queued') return '开发信已进入发送队列';
  if (currentMessage.value.status === 'sent') return '开发信已发送';
  if (currentMessage.value.status === 'failed') return '发送失败，重试操作暂未开放';
  if (currentMessage.value.status === 'skipped') return '开发信已跳过，不会继续发送';
  return '当前邮件不可发送';
});

watch(
  () => [props.item?.enrollment.id, reviewMessages.value.map(item => item.id).join('|')] as const,
  () => {
    const stillExists = reviewMessages.value.some(item => item.id === selectedMessageId.value);
    selectedMessageId.value = stillExists
      ? selectedMessageId.value
      : (reviewMessages.value.find(item => item.status === 'draft_pending_review')?.id ??
        reviewMessages.value[0]?.id ??
        null);
  },
  { immediate: true }
);

watch(
  () => [currentMessage.value?.id, currentMessage.value?.subject, currentMessage.value?.bodyText] as const,
  () => {
    draftForm.subject = currentMessage.value?.subject ?? '';
    draftForm.bodyText = currentMessage.value?.bodyText ?? '';
    selectedDraftVersionId.value = null;
    hoveredDraftVersionId.value = null;
  },
  { immediate: true }
);

watch(
  () => draftVersionItems.value.map(version => version.id).join('|'),
  () => {
    const versionIds = new Set(draftVersionItems.value.map(version => version.id));

    if (selectedDraftVersionId.value && !versionIds.has(selectedDraftVersionId.value)) {
      selectedDraftVersionId.value = null;
    }

    if (hoveredDraftVersionId.value && !versionIds.has(hoveredDraftVersionId.value)) {
      hoveredDraftVersionId.value = null;
    }
  }
);

watch(
  () => currentMessage.value?.id ?? null,
  messageId => {
    emit('loadDraftVersions', messageId);
  },
  { immediate: true }
);

function handleSave() {
  const messageId = currentMessage.value?.id;

  if (!messageId || !canEdit.value) {
    return;
  }

  if (!draftForm.subject.trim() || !draftForm.bodyText.trim()) {
    message.warning('请填写主题和正文');
    return;
  }

  if (draftForm.subject.trim().length > 200 || draftForm.bodyText.trim().length > 5000) {
    message.warning('主题不能超过 200 字，正文不能超过 5000 字');
    return;
  }

  emit(
    'saveDraft',
    buildDraftReviewOperationPayload(messageId, {
      subject: draftForm.subject.trim(),
      bodyText: draftForm.bodyText.trim()
    })
  );
}

function handleApprove() {
  const messageId = currentMessage.value?.id;

  if (!messageId || !canApprove.value) {
    return;
  }

  emit('approveDraft', { messageId });
}

function handleSelectDraftVersion(versionId: string) {
  selectedDraftVersionId.value = versionId;
}

function handleRestoreVersion(versionId: string) {
  const messageId = currentMessage.value?.id;

  if (!messageId || !canEdit.value) {
    return;
  }

  emit('restoreDraftVersion', { messageId, versionId });
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="760" placement="right">
    <NDrawerContent title="开发信草稿审核" closable>
      <NSpin :show="loading">
        <NSpace v-if="item" vertical :size="16">
          <div class="review-summary">
            <NSpace align="center" :size="8">
              <NTag :type="sequenceStatusTagTypeMap[item.enrollment.status]" :bordered="false" size="small">
                {{ sequenceStatusLabelMap[item.enrollment.status] }}
              </NTag>
              <NTag
                v-if="currentMessage"
                :type="messageStatusTagTypeMap[currentMessage.status]"
                :bordered="false"
                size="small"
              >
                {{ messageStatusLabelMap[currentMessage.status] }}
              </NTag>
            </NSpace>
            <div class="review-title">{{ item.account.name }}</div>
            <div class="review-subtitle">
              {{ formatNullableText(item.contact.fullName || item.contact.title) }} · {{ item.contact.maskedEmail }}
            </div>
          </div>

          <NDescriptions :column="1" bordered size="small" label-placement="left">
            <NDescriptionsItem label="产品线">{{ item.productLine?.name || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="发送邮箱">{{ item.mailbox?.maskedEmail || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ formatSequenceDate(item.enrollment.updatedAt) }}</NDescriptionsItem>
          </NDescriptions>

          <NDescriptions :column="2" bordered size="small" label-placement="left">
            <NDescriptionsItem label="运行版本">{{ item.enrollment.runVersion }}</NDescriptionsItem>
            <NDescriptionsItem label="队列 Job">{{ formatNullableText(currentMessage?.bullJobId) }}</NDescriptionsItem>
            <NDescriptionsItem label="计划发送">
              {{ currentMessage?.scheduledAt ? formatSequenceDate(currentMessage.scheduledAt) : '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="实际发送">
              {{ currentMessage?.sentAt ? formatSequenceDate(currentMessage.sentAt) : '-' }}
            </NDescriptionsItem>
          </NDescriptions>

          <div v-if="timelineItems.length > 1" class="message-timeline">
            <button
              v-for="timelineItem in timelineItems"
              :key="timelineItem.id"
              type="button"
              class="message-step-button"
              :class="{ 'message-step-button--selected': timelineItem.selected }"
              @click="selectedMessageId = timelineItem.id"
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

          <SendAuditPanel :item="item" :current-message="currentMessage" />

          <NDescriptions
            v-if="personaMatchRows.length"
            :column="1"
            bordered
            size="small"
            label-placement="left"
          >
            <NDescriptionsItem v-for="row in personaMatchRows" :key="row.key" :label="row.label">
              <span class="persona-match-text">{{ row.value }}</span>
            </NDescriptionsItem>
          </NDescriptions>

          <NDescriptions
            v-if="policyReviewHints.length"
            :column="1"
            bordered
            size="small"
            label-placement="left"
          >
            <NDescriptionsItem v-for="hint in policyReviewHints" :key="hint.key" :label="hint.label">
              <NSpace align="center" :size="8">
                <NTag :type="hint.tagType" :bordered="false" size="small">{{ hint.status }}</NTag>
                <span class="policy-hint-text">{{ hint.description }}</span>
              </NSpace>
            </NDescriptionsItem>
          </NDescriptions>

          <div class="drawer-section">
            <div class="section-title">第 {{ currentMessage?.stepIndex ?? 1 }} 封草稿</div>
            <NAlert type="info" :bordered="false" class="status-alert">
              {{ statusTip }}
            </NAlert>
            <NAlert v-if="aiDraftInfo" type="warning" :bordered="false" class="status-alert">
              <NSpace vertical :size="6">
                <div>
                  AI 已按「{{ aiDraftInfo.snapshot.productLineName }}」第
                  {{ aiDraftInfo.snapshot.stepIndex }} 封配置生成。{{ aiDraftInfo.reason || '请人工复核后确认。' }}
                </div>
                <NSpace v-if="aiDraftRiskNotes.length" :size="6">
                  <NTag v-for="note in aiDraftRiskNotes" :key="note" size="small" type="warning" :bordered="false">
                    {{ note }}
                  </NTag>
                </NSpace>
              </NSpace>
            </NAlert>
            <NForm :model="draftForm" label-placement="top" size="small">
              <NFormItem label="主题">
                <NInput v-model:value="draftForm.subject" :disabled="!canEdit" maxlength="200" show-count />
              </NFormItem>
              <NFormItem label="正文">
                <NInput
                  v-model:value="draftForm.bodyText"
                  type="textarea"
                  :disabled="!canEdit"
                  maxlength="5000"
                  show-count
                  :autosize="{ minRows: 12, maxRows: 18 }"
                />
              </NFormItem>
            </NForm>
          </div>

          <div class="drawer-section">
            <div class="section-title">历史版本</div>
            <NSpin :show="versionLoading">
              <NSpace v-if="draftVersionPreviewItems.length" vertical :size="8">
                <div
                  v-for="version in draftVersionPreviewItems"
                  :key="version.id"
                  class="draft-version-row"
                  :class="{ 'draft-version-row--selected': version.selected }"
                  role="button"
                  tabindex="0"
                  @click="handleSelectDraftVersion(version.id)"
                  @keydown.enter.prevent="handleSelectDraftVersion(version.id)"
                  @mouseenter="hoveredDraftVersionId = version.id"
                  @mouseleave="hoveredDraftVersionId = null"
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
                  <NPopconfirm positive-text="恢复" negative-text="取消" @positive-click="handleRestoreVersion(version.id)">
                    <template #trigger>
                      <NButton
                        size="small"
                        secondary
                        :disabled="!canEdit || versionRestoring"
                        :loading="versionRestoring"
                      >
                        恢复
                      </NButton>
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
                <div v-if="activeDraftVersionPreview" class="draft-version-preview">
                  <div class="draft-version-preview-header">
                    <span>{{ activeDraftVersionPreview.versionLabel }} 对比当前草稿</span>
                    <NTag
                      size="small"
                      :bordered="false"
                      :type="activeDraftVersionPreview.diff?.hasChanges ? 'warning' : 'success'"
                    >
                      {{ activeDraftVersionPreview.diff?.summaryText }}
                    </NTag>
                  </div>
                  <div v-if="activeDraftVersionPreview.diff?.previewLines.length" class="draft-version-preview-lines">
                    <span v-for="line in activeDraftVersionPreview.diff.previewLines" :key="line">{{ line }}</span>
                  </div>
                  <div class="draft-version-preview-label">恢复后主题</div>
                  <div class="draft-version-preview-subject">{{ activeDraftVersionPreview.record?.subject || '-' }}</div>
                  <div class="draft-version-preview-label">恢复后正文</div>
                  <pre class="draft-version-preview-body">{{ activeDraftVersionPreview.record?.bodyText || '-' }}</pre>
                </div>
              </NSpace>
              <NEmpty v-else description="暂无历史版本" />
            </NSpin>
          </div>
        </NSpace>
        <NEmpty v-else description="请选择审核项" />
      </NSpin>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="drawerVisible = false">关闭</NButton>
          <NButton
            :disabled="
              loading || saving || approving || sendStarting || stopping || nextDraftGenerating || !canRefreshSequence
            "
            :loading="refreshing"
            @click="emit('refresh')"
          >
            刷新状态
          </NButton>
          <NPopconfirm positive-text="停止" negative-text="取消" @positive-click="emit('stop')">
            <template #trigger>
              <NButton
                type="error"
                secondary
                :disabled="
                  loading ||
                    saving ||
                    approving ||
                    sendStarting ||
                    refreshing ||
                    nextDraftGenerating ||
                    !canStopSequence
                "
                :loading="stopping"
              >
                停止序列
              </NButton>
            </template>
            停止后当前序列不会继续发送，队列中的旧任务也会失效。
          </NPopconfirm>
          <NButton
            :disabled="
              loading ||
                approving ||
                refreshing ||
                sendStarting ||
                stopping ||
                versionRestoring ||
                nextDraftGenerating ||
                !currentMessage ||
                !canEdit
            "
            :loading="saving"
            @click="handleSave"
          >
            保存草稿
          </NButton>
          <NButton
            :disabled="
              loading ||
                saving ||
                refreshing ||
                sendStarting ||
                stopping ||
                versionRestoring ||
                nextDraftGenerating ||
                !currentMessage ||
                !canApprove
            "
            :loading="approving"
            @click="handleApprove"
          >
            确认草稿
          </NButton>
          <NButton
            :disabled="
              loading || saving || approving || refreshing || sendStarting || stopping || !canGenerateNextDraft
            "
            :loading="nextDraftGenerating"
            @click="emit('generateNextDraft')"
          >
            生成下一封草稿
          </NButton>
          <NButton
            type="primary"
            :disabled="
              loading ||
                saving ||
                approving ||
                refreshing ||
                stopping ||
                nextDraftGenerating ||
                !currentMessage ||
                !canStartSend
            "
            :loading="sendStarting"
            @click="emit('startSend')"
          >
            启动发送
          </NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.review-summary,
.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-summary {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 14px;
}

.review-title {
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 600;
}

.review-subtitle {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.policy-hint-text {
  color: var(--n-text-color-2);
  font-size: 12px;
}

.persona-match-text {
  color: var(--n-text-color-2);
  font-size: 12px;
}

.section-title {
  color: var(--n-text-color);
  font-size: 14px;
  font-weight: 600;
}

.status-alert {
  margin-bottom: 10px;
}

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
