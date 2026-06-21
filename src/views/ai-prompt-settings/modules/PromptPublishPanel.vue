<script setup lang="ts">
import { computed } from 'vue';
import { resolvePromptValidationSection, summarizePromptValidation } from './shared';
import type { PromptSectionKey } from './shared';

const props = defineProps<{
  validationResult: Api.AiGateway.AiPromptValidationResult | null;
  latestTestRun: Api.AiGateway.AiPromptTestRunRecord | null;
  isDirty?: boolean;
  canSaveDraft?: boolean;
  canValidate?: boolean;
  canTest?: boolean;
  canPublish?: boolean;
  savingDraft?: boolean;
  validating?: boolean;
  testing?: boolean;
  publishing?: boolean;
}>();

const emit = defineEmits<{
  validate: [];
  saveDraft: [];
  test: [];
  focusSection: [key: PromptSectionKey];
  publish: [];
}>();

const testInput = defineModel<string>('testInput', { required: true });
const changeNote = defineModel<string>('changeNote', { required: true });
const statusLabelMap: Record<Api.AiGateway.AiPromptValidationStatus, string> = {
  pass: '通过',
  warn: '预警',
  fail: '失败'
};
const statusTypeMap: Record<Api.AiGateway.AiPromptValidationStatus, 'success' | 'warning' | 'error'> = {
  pass: 'success',
  warn: 'warning',
  fail: 'error'
};
const validationSummary = computed(() => summarizePromptValidation(props.validationResult));
const validationItems = computed(() =>
  props.validationResult?.items.map(item => ({
    ...item,
    target: resolvePromptValidationSection(item)
  })) ?? []
);
const latestOutput = computed(() => props.latestTestRun?.outputText || '');
const latestValidationIssues = computed(() =>
  props.latestTestRun?.validationResult?.items
    .filter(item => item.status !== 'pass')
    .map(item => ({
      ...item,
      target: resolvePromptValidationSection(item)
    })) ?? []
);
const latestFailureGuide = computed(() => {
  if (props.latestTestRun?.success || !props.latestTestRun?.errorMessage) {
    return '';
  }

  if (props.latestTestRun.errorMessage === '系统提示词未通过校验') {
    return '这次测试还没有真正调用模型，先修复系统提示词本身的规则问题，再重新运行测试。';
  }

  if (props.latestTestRun.errorMessage === '模型输出未通过提示词规则校验') {
    return '模型已经运行，但输出结果不符合当前步骤规则。请根据下面的问题收紧提示词。';
  }

  return '最近一次测试没有通过，请先处理下面的问题。';
});
</script>

<template>
  <NCard :bordered="false" class="card-wrapper publish-panel">
    <div class="publish-panel__content">
      <div class="publish-panel__top">
        <div>
          <div class="publish-panel__eyebrow">发布闸口</div>
          <NText strong>测试与发布检查</NText>
          <p class="publish-panel__desc">{{ validationSummary.label }}</p>
        </div>
        <NTag :type="validationSummary.ok ? 'success' : 'warning'" :bordered="false">
          {{ validationSummary.ok ? '可发布' : '待检查' }}
        </NTag>
      </div>

      <div class="publish-panel__stats">
        <div class="publish-panel__stat publish-panel__stat--pass">
          <span>{{ validationSummary.passCount }}</span>
          <small>通过</small>
        </div>
        <div class="publish-panel__stat publish-panel__stat--warn">
          <span>{{ validationSummary.warnCount }}</span>
          <small>预警</small>
        </div>
        <div class="publish-panel__stat publish-panel__stat--fail">
          <span>{{ validationSummary.failCount }}</span>
          <small>失败</small>
        </div>
      </div>

      <NAlert v-if="isDirty" type="warning" :bordered="false">当前内容有未保存修改，发布前需要先保存草稿。</NAlert>

      <section class="publish-panel__section">
        <div class="publish-panel__section-title">
          <NText strong>规则校验</NText>
          <NButton size="tiny" :loading="validating" :disabled="!canValidate" @click="emit('validate')">重新校验</NButton>
        </div>
        <NEmpty v-if="!validationResult" description="尚未校验" size="small" />
        <div v-else class="publish-panel__check-list">
          <div
            v-for="item in validationItems"
            :key="item.key"
            class="publish-panel__check"
            :class="`publish-panel__check--${item.status}`"
          >
            <NTag size="small" :type="statusTypeMap[item.status]" :bordered="false">
              {{ statusLabelMap[item.status] }}
            </NTag>
            <div class="publish-panel__check-body">
              <div class="publish-panel__check-title">{{ item.label }}</div>
              <div class="publish-panel__check-message">{{ item.message }}</div>
            </div>
            <NButton
              v-if="item.target"
              size="tiny"
              text
              type="primary"
              class="publish-panel__check-action"
              @click="emit('focusSection', item.target.key)"
            >
              定位
            </NButton>
          </div>
        </div>
      </section>

      <section class="publish-panel__section">
        <div class="publish-panel__section-title">
          <NText strong>测试样例</NText>
          <NText depth="3" class="publish-panel__section-note">运行后更新最近输出</NText>
        </div>
        <NInput
          v-model:value="testInput"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          placeholder="填写一条测试获客需求"
        />
        <NButton block secondary :loading="testing" :disabled="!canTest" @click="emit('test')">运行测试</NButton>
        <div v-if="latestTestRun" class="publish-panel__test-result">
          <NSpace align="center" justify="space-between">
            <NText strong>最近测试</NText>
            <NTag size="small" :type="latestTestRun.success ? 'success' : 'error'" :bordered="false">
              {{ latestTestRun.success ? '通过' : '失败' }}
            </NTag>
          </NSpace>
          <NAlert v-if="latestFailureGuide" type="error" :bordered="false">{{ latestFailureGuide }}</NAlert>
          <NText v-if="latestTestRun.errorMessage" type="error">{{ latestTestRun.errorMessage }}</NText>
          <div v-if="latestValidationIssues.length > 0" class="publish-panel__check-list">
            <div
              v-for="item in latestValidationIssues"
              :key="item.key"
              class="publish-panel__check"
              :class="`publish-panel__check--${item.status}`"
            >
              <NTag size="small" :type="statusTypeMap[item.status]" :bordered="false">
                {{ statusLabelMap[item.status] }}
              </NTag>
              <div class="publish-panel__check-body">
                <div class="publish-panel__check-title">{{ item.label }}</div>
                <div class="publish-panel__check-message">{{ item.message }}</div>
              </div>
              <NButton
                v-if="item.target"
                size="tiny"
                text
                type="primary"
                class="publish-panel__check-action"
                @click="emit('focusSection', item.target.key)"
              >
                定位
              </NButton>
            </div>
          </div>
          <pre v-if="latestOutput" class="publish-panel__output">{{ latestOutput }}</pre>
        </div>
      </section>

      <section class="publish-panel__section">
        <NInput v-model:value="changeNote" placeholder="变更说明，例如：收紧 Maps q 规则" />
        <NSpace :size="8" justify="end">
          <NButton :loading="savingDraft" :disabled="!canSaveDraft" @click="emit('saveDraft')">保存草稿</NButton>
          <NButton type="primary" :loading="publishing" :disabled="!canPublish" @click="emit('publish')">
            发布全局版本
          </NButton>
        </NSpace>
      </section>
    </div>
  </NCard>
</template>

<style scoped>
.publish-panel__content {
  display: grid;
  gap: 14px;
}

.publish-panel__top,
.publish-panel__section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.publish-panel__eyebrow {
  margin-bottom: 4px;
  color: var(--prompt-workbench-primary);
  font-size: 12px;
  font-weight: 700;
}

.publish-panel__desc {
  margin: 4px 0 0;
  color: var(--prompt-workbench-subtle);
  font-size: 13px;
}

.publish-panel__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.publish-panel__stat {
  display: grid;
  gap: 2px;
  padding: 8px;
  border: 1px solid var(--prompt-workbench-border);
  border-radius: 6px;
  background: var(--prompt-workbench-muted);
}

.publish-panel__stat span {
  color: var(--prompt-workbench-ink);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.publish-panel__stat small {
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
}

.publish-panel__stat--pass span {
  color: rgb(var(--success-color));
}

.publish-panel__stat--warn span {
  color: rgb(var(--warning-color));
}

.publish-panel__stat--fail span {
  color: rgb(var(--error-color));
}

.publish-panel__section {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--prompt-workbench-border);
}

.publish-panel__section-note {
  font-size: 12px;
}

.publish-panel__check-list {
  display: grid;
  gap: 8px;
}

.publish-panel__check {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--prompt-workbench-border);
  border-left-width: 3px;
  border-radius: 6px;
  background: #fff;
}

.publish-panel__check--pass {
  border-left-color: rgb(var(--success-color));
}

.publish-panel__check--warn {
  border-left-color: rgb(var(--warning-color));
}

.publish-panel__check--fail {
  border-left-color: rgb(var(--error-color));
}

.publish-panel__check-body {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.publish-panel__check-title {
  color: var(--prompt-workbench-ink);
  font-weight: 600;
  line-height: 1.4;
}

.publish-panel__check-message {
  color: var(--prompt-workbench-subtle);
  font-size: 12px;
  line-height: 1.5;
}

.publish-panel__check-action {
  margin-top: 1px;
}

.publish-panel__test-result {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--prompt-workbench-border);
  border-radius: 6px;
  background: var(--prompt-workbench-muted);
}

.publish-panel__output {
  overflow: auto;
  max-height: 180px;
  margin: 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--n-code-color);
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
