import { computed, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { defaultAiPromptKey, type AiPromptKey } from '@/constants/ai-gateway';
import {
  fetchAiPromptWorkbenchDetail,
  fetchAiPromptWorkbenchSteps,
  publishAiPromptVersion,
  rollbackAiPromptVersion
} from '@/service/api';
import type { PromptFocusSectionRequest, PromptSectionKey } from './shared';

/** Owns prompt workbench state and backend actions for the route view. */
export function usePromptSettingsPage() {
  const message = useMessage();
  const steps = shallowRef<Api.AiGateway.AiPromptStepSummary[]>([]);
  const detail = shallowRef<Api.AiGateway.AiPromptWorkbenchDetail | null>(null);
  const selectedPromptKey = shallowRef<AiPromptKey>(defaultAiPromptKey);
  const systemPrompt = shallowRef('');
  const changeNote = shallowRef('');
  const focusSectionRequest = shallowRef<PromptFocusSectionRequest | null>(null);
  const loadingSteps = shallowRef(false);
  const loadingDetail = shallowRef(false);
  const publishing = shallowRef(false);
  const rollingBackVersionId = shallowRef<string | null>(null);
  let detailRequestId = 0;

  const selectedStep = computed(
    () => steps.value.find(step => step.promptKey === selectedPromptKey.value) ?? detail.value ?? null
  );
  const versions = computed(() => detail.value?.versions ?? []);
  const basePrompt = computed(
    () => detail.value?.published?.systemPrompt || detail.value?.defaultPrompt.systemPrompt || ''
  );
  const isDirty = computed(() => systemPrompt.value.trim() !== basePrompt.value.trim());
  const canPublish = computed(() => Boolean(systemPrompt.value.trim()) && !publishing.value);
  const publishReadinessHint = computed(() =>
    canPublish.value ? '点击后会直接发布为全局版本' : '系统提示词不能为空'
  );

  /** Loads prompt configuration steps and opens the selected prompt detail. */
  async function loadSteps(preferredPromptKey: string = selectedPromptKey.value) {
    loadingSteps.value = true;

    try {
      const { data, error } = await fetchAiPromptWorkbenchSteps();

      if (error || !data) {
        return;
      }

      steps.value = data;
      selectedPromptKey.value = (
        data.some(step => step.promptKey === preferredPromptKey)
          ? preferredPromptKey
          : data[0]?.promptKey || defaultAiPromptKey
      ) as AiPromptKey;
      await loadDetail(selectedPromptKey.value);
    } finally {
      loadingSteps.value = false;
    }
  }

  /** Switches the selected prompt and loads detail with stale request protection. */
  async function selectPrompt(promptKey: string) {
    selectedPromptKey.value = promptKey as AiPromptKey;
    await loadDetail(promptKey);
  }

  async function loadDetail(promptKey: string = selectedPromptKey.value) {
    const requestId = detailRequestId + 1;
    detailRequestId = requestId;
    loadingDetail.value = true;

    try {
      const { data, error } = await fetchAiPromptWorkbenchDetail(promptKey);

      if (error || !data || requestId !== detailRequestId) {
        return;
      }

      detail.value = data;
      systemPrompt.value = data.published?.systemPrompt || data.defaultPrompt.systemPrompt;
      changeNote.value = '';
    } finally {
      if (requestId === detailRequestId) {
        loadingDetail.value = false;
      }
    }
  }

  async function publishCurrentPrompt() {
    if (!systemPrompt.value.trim()) {
      message.warning('系统提示词不能为空');
      return;
    }

    if (publishing.value || !selectedStep.value) {
      return;
    }

    publishing.value = true;

    try {
      const { error } = await publishAiPromptVersion({
        promptKey: selectedPromptKey.value,
        title: selectedStep.value.title,
        systemPrompt: systemPrompt.value,
        changeNote: changeNote.value
      });

      if (error) {
        return;
      }

      message.success('全局版本已发布');
      await Promise.all([loadSteps(selectedPromptKey.value), loadDetail(selectedPromptKey.value)]);
    } finally {
      publishing.value = false;
    }
  }

  async function rollbackVersion(version: Api.AiGateway.AiPromptVersionRecord) {
    if (rollingBackVersionId.value) {
      return;
    }

    rollingBackVersionId.value = version.id;

    try {
      const { error } = await rollbackAiPromptVersion({
        promptKey: selectedPromptKey.value,
        versionId: version.id,
        changeNote: `回滚到 v${version.version}`
      });

      if (error) {
        return;
      }

      message.success(`已回滚到 v${version.version}`);
      await Promise.all([loadSteps(selectedPromptKey.value), loadDetail(selectedPromptKey.value)]);
    } finally {
      rollingBackVersionId.value = null;
    }
  }

  function useDefaultPrompt() {
    if (!detail.value) {
      return;
    }

    systemPrompt.value = detail.value.defaultPrompt.systemPrompt;
  }

  /** Requests the prompt editor to focus one known section. */
  function focusPromptSection(key: PromptSectionKey) {
    focusSectionRequest.value = {
      key,
      nonce: Date.now()
    };
  }

  return {
    steps,
    detail,
    selectedPromptKey,
    selectedStep,
    systemPrompt,
    changeNote,
    focusSectionRequest,
    versions,
    loadingSteps,
    loadingDetail,
    publishing,
    rollingBackVersionId,
    isDirty,
    canPublish,
    publishReadinessHint,
    loadSteps,
    selectPrompt,
    publishCurrentPrompt,
    rollbackVersion,
    useDefaultPrompt,
    focusPromptSection
  };
}
