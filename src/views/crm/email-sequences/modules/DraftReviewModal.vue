<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import DraftAiInfoPanel from './DraftAiInfoPanel.vue';
import DraftVersionHistory from './DraftVersionHistory.vue';
import SendAuditPanel from './SendAuditPanel.vue';
import SequenceMessageTimeline from './SequenceMessageTimeline.vue';
import {
  formatNullableText,
  formatSequenceDate,
  buildDraftReviewOperationPayload,
  buildDraftVersionDiffSummary,
  buildDraftVersionListItems,
  buildSequenceMessageTimelineItems,
  buildSequencePolicyReviewHints,
  canGenerateNextSequenceDraft,
  isDraftBlockedBySequencePolicy,
  getMessageStatusView,
  type DraftReviewApprovePayload,
  type DraftReviewSavePayload,
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

type AiDraftDisplayInfo = Api.Crm.AiDraftMetadata & {
  qualityNotes?: string[];
};

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

const message = useMessage();
const modalVisible = computed({
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
const timelineItems = computed(() =>
  buildSequenceMessageTimelineItems(reviewMessages.value, selectedMessageId.value, props.item?.enrollment.status)
);
const currentMessageStatusView = computed(() =>
  currentMessage.value && props.item ? getMessageStatusView(currentMessage.value, props.item.enrollment.status) : null
);
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
const isCurrentDraftBlockedByPolicy = computed(() =>
  Boolean(props.item && isDraftBlockedBySequencePolicy(props.item, currentMessage.value))
);
const canApprove = computed(() => canOperateSelectedDraft.value && !isCurrentDraftBlockedByPolicy.value);
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
const aiDraftInfo = computed<AiDraftDisplayInfo | null>(() => currentMessage.value?.aiDraft ?? null);
const aiDraftSnapshot = computed(() => aiDraftInfo.value?.snapshot ?? null);
const aiDraftGeneratedAtText = computed(() => {
  const generatedAt = aiDraftSnapshot.value?.generatedAt;

  return generatedAt ? formatSequenceDate(generatedAt) : '-';
});
const aiDraftSummaryRows = computed<AiDraftDescriptionRow[]>(() => {
  const snapshot = aiDraftSnapshot.value;

  if (!snapshot) return [];

  return [
    {
      key: 'product-line',
      label: '产品线',
      value: formatNullableText(snapshot.productLineName)
    },
    {
      key: 'step',
      label: 'Step',
      value: `第 ${snapshot.stepIndex} 封`
    },
    {
      key: 'generated-at',
      label: '生成时间',
      value: aiDraftGeneratedAtText.value
    },
    {
      key: 'reason',
      label: '生成说明',
      value: aiDraftInfo.value?.reason || snapshot.reason || '请人工复核后确认。'
    }
  ];
});
const aiDraftPromptSnapshotRows = computed<AiDraftDescriptionRow[]>(() => {
  const snapshot = aiDraftSnapshot.value;

  if (!snapshot) return [];

  const writingConfig = snapshot.writingConfig;

  return [
    {
      key: 'common-requirements',
      label: '通用要求',
      value: formatPromptSnapshotText(writingConfig.commonRequirements)
    },
    {
      key: 'forbidden-claims',
      label: '禁止内容',
      value: formatPromptSnapshotText(writingConfig.forbiddenClaims)
    },
    {
      key: 'product-emphasis',
      label: '产品重点',
      value: formatPromptSnapshotText(writingConfig.productEmphasis)
    },
    {
      key: 'step-prompt',
      label: `Step ${snapshot.stepIndex} Prompt`,
      value: formatPromptSnapshotText(findAiDraftStepPrompt(writingConfig.steps, snapshot.stepIndex))
    }
  ];
});
const aiDraftReviewTags = computed<AiDraftReviewTag[]>(() => {
  const riskTags = (aiDraftInfo.value?.riskNotes ?? aiDraftSnapshot.value?.riskNotes ?? []).map((note, index) => ({
    key: `risk-${index}-${note}`,
    label: `风险：${note}`,
    type: 'warning' as const
  }));
  const qualityTags = (aiDraftInfo.value?.qualityNotes ?? []).map((note, index) => ({
    key: `quality-${index}-${note}`,
    label: `质量：${note}`,
    type: 'warning' as const
  }));

  return [...riskTags, ...qualityTags];
});
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
  if (isCurrentDraftBlockedByPolicy.value) return '当前策略阻止新增链接，请删除草稿中的链接后再确认';
  if (!isFirstMessageSelected.value && currentMessage.value.status === 'draft_pending_review')
    return '确认后会按计划时间进入发送队列';
  if (currentMessage.value.status === 'draft_pending_review') return '草稿待人工确认后才能进入发送队列';
  if (
    currentMessage.value.status === 'draft_ready' &&
    currentMessage.value.scheduledAt &&
    props.item?.enrollment.status === 'sequence_running'
  )
    return '草稿已确认，等待发送调度器按计划入队';
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
    if (isCurrentDraftBlockedByPolicy.value) {
      message.warning('当前草稿仍包含链接，请删除链接后再确认');
    }
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

/** Keep prompt snapshot blanks compact while preserving actual prompt line breaks. */
function formatPromptSnapshotText(value: string | null | undefined) {
  return value?.trim() || '-';
}

/** Find the prompt used for the selected step from the immutable AI snapshot. */
function findAiDraftStepPrompt(steps: Api.Crm.ProductLineAiWritingStepConfig[] | undefined, stepIndex: number) {
  return steps?.find(step => step.stepIndex === stepIndex)?.prompt ?? '';
}
</script>

<template>
  <NModal
    v-model:show="modalVisible"
    preset="card"
    title="开发信草稿审核"
    class="draft-review-modal"
    :mask-closable="false"
  >
    <NSpin :show="loading">
      <NScrollbar class="draft-review-scroll">
        <div v-if="item" class="review-workbench">
          <div class="review-hero">
            <div class="review-hero-main">
              <NSpace align="center" :size="8">
                <NTag :type="sequenceStatusTagTypeMap[item.enrollment.status]" :bordered="false" size="small">
                  {{ sequenceStatusLabelMap[item.enrollment.status] }}
                </NTag>
                <NTag v-if="currentMessage" :type="currentMessageStatusView?.tagType" :bordered="false" size="small">
                  {{ currentMessageStatusView?.label }}
                </NTag>
              </NSpace>
              <div class="review-title">{{ item.account.name }}</div>
              <div class="review-subtitle">
                {{ formatNullableText(item.contact.fullName || item.contact.title) }} · {{ item.contact.maskedEmail }}
              </div>
            </div>
            <div class="review-hero-meta">
              <div class="review-meta-item">
                <span class="review-meta-label">产品线</span>
                <span class="review-meta-value">{{ item.productLine?.name || '-' }}</span>
              </div>
              <div class="review-meta-item">
                <span class="review-meta-label">发送邮箱</span>
                <span class="review-meta-value">{{ item.mailbox?.maskedEmail || '-' }}</span>
              </div>
              <div class="review-meta-item">
                <span class="review-meta-label">更新时间</span>
                <span class="review-meta-value">{{ formatSequenceDate(item.enrollment.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <div class="sequence-strip">
            <div class="sequence-strip-title">邮件步骤</div>
            <SequenceMessageTimeline
              v-if="timelineItems.length > 1"
              :items="timelineItems"
              @select="selectedMessageId = $event"
            />
            <NEmpty v-else description="暂无后续邮件" size="small" />
          </div>

          <div class="review-flow">
            <main class="review-main">
              <div class="review-section">
                <div class="section-heading">
                  <div>
                    <div class="section-title">第 {{ currentMessage?.stepIndex ?? 1 }} 封草稿</div>
                  </div>
                </div>
                <NAlert type="info" :bordered="false" class="status-alert">
                  {{ statusTip }}
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
                      :autosize="{ minRows: 14, maxRows: 22 }"
                    />
                  </NFormItem>
                </NForm>
              </div>
            </main>

            <aside class="decision-panel">
              <div>
                <div class="section-title">当前处理</div>
                <div class="decision-subtitle">{{ statusTip }}</div>
              </div>
              <div class="decision-checks">
                <div
                  v-for="check in item.checklist"
                  :key="check.key"
                  class="decision-check"
                  :class="{ 'decision-check--passed': check.passed, 'decision-check--warning': !check.passed }"
                >
                  <NTag :type="check.passed ? 'success' : 'warning'" :bordered="false" size="small">
                    {{ check.passed ? '通过' : '确认' }}
                  </NTag>
                  <div class="decision-check-content">
                    <div class="decision-check-title">{{ check.label }}</div>
                    <div class="decision-check-message">{{ check.message }}</div>
                  </div>
                </div>
                <NEmpty v-if="!item.checklist.length" description="暂无需要确认的审核项" size="small" />
              </div>
            </aside>
          </div>

          <NCollapse class="advanced-info">
            <NCollapseItem title="历史版本" name="draft-versions">
              <DraftVersionHistory
                :items="draftVersionPreviewItems"
                :active-preview="activeDraftVersionPreview"
                :loading="versionLoading"
                :can-edit="canEdit"
                :restoring="versionRestoring"
                @select="handleSelectDraftVersion"
                @hover="hoveredDraftVersionId = $event"
                @restore="handleRestoreVersion"
              />
            </NCollapseItem>

            <NCollapseItem title="发送安排" name="send-schedule">
              <NDescriptions :column="2" bordered size="small" label-placement="left">
                <NDescriptionsItem label="运行版本">{{ item.enrollment.runVersion }}</NDescriptionsItem>
                <NDescriptionsItem label="队列 Job">
                  {{ formatNullableText(currentMessage?.bullJobId) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="计划发送">
                  {{ currentMessage?.scheduledAt ? formatSequenceDate(currentMessage.scheduledAt) : '-' }}
                </NDescriptionsItem>
                <NDescriptionsItem label="实际发送">
                  {{ currentMessage?.sentAt ? formatSequenceDate(currentMessage.sentAt) : '-' }}
                </NDescriptionsItem>
              </NDescriptions>
            </NCollapseItem>

            <NCollapseItem title="发送前审核明细" name="send-audit">
              <SendAuditPanel :item="item" :current-message="currentMessage" />
            </NCollapseItem>

            <NCollapseItem v-if="personaMatchRows.length" title="客户画像" name="persona">
              <NDescriptions :column="1" bordered size="small" label-placement="left">
                <NDescriptionsItem v-for="row in personaMatchRows" :key="row.key" :label="row.label">
                  <span class="persona-match-text">{{ row.value }}</span>
                </NDescriptionsItem>
              </NDescriptions>
            </NCollapseItem>

            <NCollapseItem v-if="policyReviewHints.length" title="策略校验" name="policy">
              <NDescriptions :column="1" bordered size="small" label-placement="left">
                <NDescriptionsItem v-for="hint in policyReviewHints" :key="hint.key" :label="hint.label">
                  <NSpace align="center" :size="8">
                    <NTag :type="hint.tagType" :bordered="false" size="small">{{ hint.status }}</NTag>
                    <span class="policy-hint-text">{{ hint.description }}</span>
                  </NSpace>
                </NDescriptionsItem>
              </NDescriptions>
            </NCollapseItem>

            <NCollapseItem v-if="aiDraftInfo" title="AI 生成信息" name="ai-draft">
              <DraftAiInfoPanel
                :summary-rows="aiDraftSummaryRows"
                :review-tags="aiDraftReviewTags"
                :prompt-snapshot-rows="aiDraftPromptSnapshotRows"
              />
            </NCollapseItem>
          </NCollapse>
        </div>
        <NEmpty v-else description="请选择审核项" />
      </NScrollbar>
    </NSpin>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="modalVisible = false">关闭</NButton>
        <div class="modal-actions">
          <NButton
            v-if="canRefreshSequence"
            :disabled="
              loading || saving || approving || sendStarting || stopping || nextDraftGenerating
            "
            :loading="refreshing"
            @click="emit('refresh')"
          >
            刷新状态
          </NButton>
          <NPopconfirm v-if="canStopSequence" positive-text="停止" negative-text="取消" @positive-click="emit('stop')">
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
                    nextDraftGenerating
                "
                :loading="stopping"
              >
                停止序列
              </NButton>
            </template>
            停止后当前序列不会继续发送，队列中的旧任务也会失效。
          </NPopconfirm>
          <NButton
            v-if="canEdit"
            :disabled="
              loading ||
                approving ||
                refreshing ||
                sendStarting ||
                stopping ||
                versionRestoring ||
                nextDraftGenerating ||
                !currentMessage
            "
            :loading="saving"
            @click="handleSave"
          >
            保存草稿
          </NButton>
          <NButton
            v-if="canOperateSelectedDraft"
            type="primary"
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
            v-if="canGenerateNextDraft"
            :disabled="loading || saving || approving || refreshing || sendStarting || stopping"
            :loading="nextDraftGenerating"
            @click="emit('generateNextDraft')"
          >
            生成下一封草稿
          </NButton>
          <NButton
            v-if="canStartSend"
            type="primary"
            :disabled="
              loading ||
                saving ||
                approving ||
                refreshing ||
                stopping ||
                nextDraftGenerating ||
                !currentMessage
            "
            :loading="sendStarting"
            @click="emit('startSend')"
          >
            启动发送
          </NButton>
        </div>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.review-workbench,
.review-section,
.review-main,
.decision-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.draft-review-modal {
  width: min(1180px, calc(100vw - 48px));
}

.draft-review-scroll {
  max-height: min(72vh, 760px);
}

.review-workbench {
  gap: 16px;
  padding-right: 2px;
}

.review-hero {
  display: grid;
  align-items: stretch;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-table-color);
  padding: 16px;
}

.review-hero-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.review-hero-meta {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.review-meta-item {
  display: flex;
  min-width: 0;
  border-left: 1px solid var(--n-divider-color);
  flex-direction: column;
  gap: 4px;
  padding-left: 12px;
}

.review-meta-label {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.review-meta-value {
  overflow: hidden;
  color: var(--n-text-color);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-flow {
  display: grid;
  align-items: start;
  gap: 16px;
  grid-template-columns: minmax(520px, 1.5fr) minmax(300px, 0.82fr);
}

.review-section {
  min-width: 0;
}

.decision-panel {
  min-width: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-table-color);
  padding: 14px;
}

.decision-subtitle {
  margin-top: 4px;
  color: var(--n-text-color-3);
  font-size: 12px;
  line-height: 1.5;
}

.decision-checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.decision-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 6px;
  padding: 10px;
}

.decision-check--passed {
  background: rgba(82, 196, 26, 0.08);
}

.decision-check--warning {
  background: rgba(250, 173, 20, 0.1);
}

.decision-check-content {
  min-width: 0;
}

.decision-check-title {
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 600;
}

.decision-check-message {
  margin-top: 2px;
  color: var(--n-text-color-2);
  font-size: 12px;
  line-height: 1.5;
}

.advanced-info {
  border-top: 1px solid var(--n-divider-color);
  padding-top: 4px;
}

.sequence-strip {
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: 72px minmax(0, 1fr);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 10px 12px;
}

.sequence-strip-title {
  color: var(--n-text-color-3);
  font-size: 12px;
  font-weight: 600;
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

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.status-alert {
  margin-bottom: 10px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1280px) {
  .review-flow {
    grid-template-columns: minmax(460px, 1.35fr) minmax(280px, 0.85fr);
  }
}

@media (max-width: 900px) {
  .draft-review-modal {
    width: calc(100vw - 24px);
  }

  .review-hero,
  .review-flow,
  .sequence-strip {
    grid-template-columns: 1fr;
  }

  .review-hero-meta {
    grid-template-columns: 1fr;
  }

  .review-meta-item {
    border-left: 0;
    border-top: 1px solid var(--n-divider-color);
    padding-top: 10px;
    padding-left: 0;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-actions {
    justify-content: flex-start;
  }
}
</style>
