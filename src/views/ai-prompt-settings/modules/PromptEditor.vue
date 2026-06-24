<script setup lang="ts">
import type { InputInst } from 'naive-ui';
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import { buildPromptSectionAnchors, resolvePromptLineStartOffset } from './shared';
import type { PromptFocusSectionRequest, PromptSectionAnchor } from './shared';

const props = defineProps<{
  detail: Api.AiGateway.AiPromptWorkbenchDetail | null;
  focusSectionRequest?: PromptFocusSectionRequest | null;
  loading?: boolean;
  versionCount?: number;
}>();

const emit = defineEmits<{
  openVersions: [];
  useDefault: [];
}>();

const systemPrompt = defineModel<string>('systemPrompt', { required: true });
const activeTab = shallowRef<'prompt' | 'default'>('prompt');
const editorInputRef = useTemplateRef<InputInst>('editorInput');
const anchors = computed(() => buildPromptSectionAnchors(systemPrompt.value));
const selectedTitle = computed(() => props.detail?.title || '提示词配置');
const selectedUsage = computed(() => props.detail?.usage || '维护 AI 业务内置步骤的系统提示词。');
const selectedPromptKey = computed(() => props.detail?.promptKey || '-');
const defaultPromptPreview = computed(() => props.detail?.defaultPrompt.systemPrompt || '');

/** Moves the textarea caret to the selected prompt section and lets the browser scroll it into view. */
async function handleAnchorClick(anchor: PromptSectionAnchor) {
  await nextTick();

  const inputInst = editorInputRef.value;
  const textarea = inputInst?.textareaElRef;

  if (!inputInst || !textarea) {
    return;
  }

  const offset = resolvePromptLineStartOffset(systemPrompt.value, anchor.line);

  inputInst.focus();
  textarea.setSelectionRange(offset, offset);
}

watch(
  () => props.focusSectionRequest?.nonce,
  nonce => {
    if (!nonce || !props.focusSectionRequest) {
      return;
    }

    const anchor = anchors.value.find(item => item.key === props.focusSectionRequest?.key);

    if (!anchor) {
      return;
    }

    void handleAnchorClick(anchor);
  }
);
</script>

<template>
  <NCard :bordered="false" class="card-wrapper prompt-editor">
    <NSpin :show="loading">
      <div class="prompt-editor__header">
        <div class="prompt-editor__title-group">
          <div class="prompt-editor__eyebrow">AI 业务提示词</div>
          <h2 class="prompt-editor__title">{{ selectedTitle }}</h2>
          <p class="prompt-editor__desc">{{ selectedUsage }}</p>
          <div class="prompt-editor__meta">
            <span>{{ selectedPromptKey }}</span>
            <span>{{ props.detail?.channel || '-' }}</span>
          </div>
        </div>
        <NSpace :size="8" class="prompt-editor__actions">
          <NTooltip>
            <template #trigger>
              <NBadge :value="versionCount" :max="99" :show-zero="false">
                <NButton size="small" circle secondary aria-label="打开版本记录" @click="emit('openVersions')">
                  <template #icon>
                    <SvgIcon icon="material-symbols:history" />
                  </template>
                </NButton>
              </NBadge>
            </template>
            版本记录
          </NTooltip>
          <NTag type="warning" :bordered="false">仅超级管理员</NTag>
          <NButton size="small" @click="emit('useDefault')">恢复默认</NButton>
        </NSpace>
      </div>

      <NTabs v-model:value="activeTab" size="small" type="line" animated>
        <NTabPane name="prompt" tab="系统提示词">
          <div class="prompt-editor__body">
            <aside class="prompt-editor__anchors">
              <NText depth="3" class="prompt-editor__anchor-title">段落定位</NText>
              <NButton
                v-for="anchor in anchors"
                :key="anchor.key"
                size="tiny"
                quaternary
                class="prompt-editor__anchor"
                @click="handleAnchorClick(anchor)"
              >
                {{ anchor.label }}
                <span>L{{ anchor.line }}</span>
              </NButton>
            </aside>
            <NInput
              ref="editorInput"
              v-model:value="systemPrompt"
              type="textarea"
              class="prompt-editor__textarea"
              :autosize="{ minRows: 26, maxRows: 34 }"
              placeholder="写入模型必须遵守的固定规则"
            />
          </div>
        </NTabPane>
        <NTabPane name="default" tab="默认模板">
          <pre class="prompt-editor__preview">{{ defaultPromptPreview }}</pre>
        </NTabPane>
      </NTabs>
    </NSpin>
  </NCard>
</template>

<style scoped>
.prompt-editor {
  min-height: 100%;
}

.prompt-editor__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.prompt-editor__title-group {
  min-width: 0;
}

.prompt-editor__actions {
  flex-shrink: 0;
}

.prompt-editor__eyebrow {
  margin-bottom: 4px;
  color: var(--prompt-workbench-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.prompt-editor__title {
  margin: 0;
  color: var(--prompt-workbench-ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
}

.prompt-editor__desc {
  margin: 6px 0 0;
  max-width: 720px;
  color: var(--prompt-workbench-subtle);
  line-height: 1.6;
}

.prompt-editor__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.prompt-editor__meta span {
  max-width: 100%;
  padding: 3px 8px;
  border: 1px solid var(--prompt-workbench-border);
  border-radius: 6px;
  color: var(--prompt-workbench-subtle);
  background: var(--prompt-workbench-muted);
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.prompt-editor__body {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 12px;
}

.prompt-editor__anchors {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--prompt-workbench-border);
  border-radius: 6px;
  background: var(--prompt-workbench-muted);
}

.prompt-editor__anchor-title {
  padding: 0 6px 4px;
  font-size: 12px;
}

.prompt-editor__anchor {
  justify-content: flex-start;
}

.prompt-editor__anchor span {
  color: var(--n-text-color-3);
  font-size: 11px;
}

.prompt-editor__textarea :deep(.n-input-wrapper) {
  min-height: calc(100vh - 340px);
}

.prompt-editor__preview {
  overflow: auto;
  max-height: calc(100vh - 316px);
  margin: 0;
  padding: 14px;
  border: 1px solid var(--prompt-workbench-border);
  border-radius: 6px;
  background: var(--n-code-color);
  white-space: pre-wrap;
}

@media (max-width: 960px) {
  .prompt-editor__body {
    grid-template-columns: 1fr;
  }

  .prompt-editor__anchors {
    flex-flow: row wrap;
  }

  .prompt-editor__textarea :deep(.n-input-wrapper) {
    min-height: 420px;
  }
}
</style>
