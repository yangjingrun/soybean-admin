import { computed, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { defaultAiPromptKey, type AiPromptKey } from '@/constants/ai-gateway';
import {
  fetchAiPromptWorkbenchDetail,
  fetchAiPromptWorkbenchSteps,
  publishAiPromptDraft,
  rollbackAiPromptVersion,
  saveAiPromptDraft,
  testAiPromptDraft,
  validateAiPromptDraft
} from '@/service/api';
import { resolvePromptPublishBlockReason } from './shared';
import type { PromptFocusSectionRequest, PromptSectionKey } from './shared';

const defaultTestInput = '我是河北卖轴承的，想找纽约周边有门店和电话的轴承经销商';

/** Owns prompt workbench state and backend actions for the route view. */
export function usePromptSettingsPage() {
  const message = useMessage();
  const steps = shallowRef<Api.AiGateway.AiPromptStepSummary[]>([]);
  const detail = shallowRef<Api.AiGateway.AiPromptWorkbenchDetail | null>(null);
  const selectedPromptKey = shallowRef<AiPromptKey>(defaultAiPromptKey);
  const systemPrompt = shallowRef('');
  const changeNote = shallowRef('');
  const testInput = shallowRef(defaultTestInput);
  const validationResult = shallowRef<Api.AiGateway.AiPromptValidationResult | null>(null);
  const latestTestRun = shallowRef<Api.AiGateway.AiPromptTestRunRecord | null>(null);
  const validatedPromptText = shallowRef('');
  const focusSectionRequest = shallowRef<PromptFocusSectionRequest | null>(null);
  const loadingSteps = shallowRef(false);
  const loadingDetail = shallowRef(false);
  const savingDraft = shallowRef(false);
  const validating = shallowRef(false);
  const testing = shallowRef(false);
  const publishing = shallowRef(false);
  const rollingBackVersionId = shallowRef<string | null>(null);
  let detailRequestId = 0;

  const selectedStep = computed(
    () => steps.value.find(step => step.promptKey === selectedPromptKey.value) ?? detail.value ?? null
  );
  const versions = computed(() => detail.value?.versions ?? []);
  const basePrompt = computed(
    () =>
      detail.value?.draft?.systemPrompt ||
      detail.value?.published?.systemPrompt ||
      detail.value?.defaultPrompt.systemPrompt ||
      ''
  );
  const isDirty = computed(() => systemPrompt.value.trim() !== basePrompt.value.trim());
  const canSaveDraft = computed(() => Boolean(systemPrompt.value.trim()) && !savingDraft.value);
  const canValidate = computed(() => Boolean(systemPrompt.value.trim()) && !validating.value);
  const canTest = computed(() => Boolean(systemPrompt.value.trim() && testInput.value.trim()) && !testing.value);
  const hasFreshValidationResult = computed(
    () => Boolean(validationResult.value) && validatedPromptText.value === systemPrompt.value.trim()
  );
  const publishBlockedReason = computed(() =>
    resolvePromptPublishBlockReason({
      hasDraft: Boolean(detail.value?.draft),
      isDirty: isDirty.value,
      hasFreshValidationResult: hasFreshValidationResult.value,
      validationPassed: Boolean(validationResult.value?.ok)
    })
  );
  const canPublish = computed(() => !publishBlockedReason.value && !publishing.value);
  const publishReadinessHint = computed(() => {
    if (publishBlockedReason.value) {
      return publishBlockedReason.value;
    }

    if (isDirty.value || !detail.value?.draft) {
      return '测试通过后可直接发布，发布时会自动保存当前修改';
    }

    return '当前草稿已满足发布条件';
  });

  /** Loads built-in prompt steps and opens the selected prompt detail. */
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
      systemPrompt.value = data.draft?.systemPrompt || data.published?.systemPrompt || data.defaultPrompt.systemPrompt;
      validationResult.value = data.draft?.validationResult ?? null;
      validatedPromptText.value = data.draft?.validationResult ? systemPrompt.value.trim() : '';
      latestTestRun.value = data.latestTestRun;
      changeNote.value = '';
    } finally {
      if (requestId === detailRequestId) {
        loadingDetail.value = false;
      }
    }
  }

  async function validateCurrentPrompt() {
    if (!canValidate.value) {
      return;
    }

    validating.value = true;

    try {
      const { data, error } = await validateAiPromptDraft({
        promptKey: selectedPromptKey.value,
        systemPrompt: systemPrompt.value
      });

      if (error || !data) {
        return;
      }

      validationResult.value = data;
      validatedPromptText.value = systemPrompt.value.trim();
      message[data.ok ? 'success' : 'warning'](data.ok ? '校验通过' : '校验发现需要修复的规则');
    } finally {
      validating.value = false;
    }
  }

  async function saveCurrentDraft(options?: { silent?: boolean; skipReload?: boolean }) {
    if (!canSaveDraft.value || !selectedStep.value) {
      return false;
    }

    savingDraft.value = true;

    try {
      const { data, error } = await saveAiPromptDraft({
        promptKey: selectedPromptKey.value,
        title: selectedStep.value.title,
        systemPrompt: systemPrompt.value,
        changeNote: changeNote.value
      });

      if (error || !data) {
        return false;
      }

      if (!options?.silent) {
        message.success('草稿已保存');
      }

      if (options?.skipReload) {
        return true;
      }

      await Promise.all([loadSteps(selectedPromptKey.value), loadDetail(selectedPromptKey.value)]);
      return true;
    } finally {
      savingDraft.value = false;
    }
  }

  async function testCurrentDraft() {
    if (!canTest.value) {
      return;
    }

    testing.value = true;

    try {
      const { data, error } = await testAiPromptDraft({
        promptKey: selectedPromptKey.value,
        systemPrompt: systemPrompt.value,
        inputPrompt: testInput.value
      });

      if (error || !data) {
        return;
      }

      latestTestRun.value = data;
      validationResult.value = data.validationResult;
      validatedPromptText.value = systemPrompt.value.trim();
      message[data.success ? 'success' : 'warning'](data.success ? '测试通过' : '测试输出未通过校验');
      await loadSteps(selectedPromptKey.value);
    } finally {
      testing.value = false;
    }
  }

  async function publishCurrentDraft() {
    if (publishBlockedReason.value) {
      message.warning(publishBlockedReason.value);
      return;
    }

    if (publishing.value) {
      return;
    }

    publishing.value = true;

    try {
      const shouldAutoSave = isDirty.value || !detail.value?.draft;

      if (shouldAutoSave) {
        const saved = await saveCurrentDraft({ silent: true, skipReload: true });

        if (!saved) {
          return;
        }
      }

      const { error } = await publishAiPromptDraft({
        promptKey: selectedPromptKey.value,
        changeNote: changeNote.value
      });

      if (error) {
        return;
      }

      message.success(shouldAutoSave ? '当前内容已自动保存并发布' : '全局版本已发布');
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
    validationResult.value = null;
    validatedPromptText.value = '';
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
    testInput,
    validationResult,
    latestTestRun,
    focusSectionRequest,
    versions,
    loadingSteps,
    loadingDetail,
    savingDraft,
    validating,
    testing,
    publishing,
    rollingBackVersionId,
    isDirty,
    canSaveDraft,
    canValidate,
    canTest,
    canPublish,
    publishReadinessHint,
    loadSteps,
    selectPrompt,
    validateCurrentPrompt,
    saveCurrentDraft,
    testCurrentDraft,
    publishCurrentDraft,
    rollbackVersion,
    useDefaultPrompt,
    focusPromptSection
  };
}
