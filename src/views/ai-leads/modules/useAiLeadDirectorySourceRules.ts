import { computed, reactive, ref, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import {
  createLeadDirectorySourceRule,
  deleteLeadDirectorySourceRule,
  fetchLeadDirectorySourceRules,
  updateLeadDirectorySourceRule
} from '@/service/api';
import { parseDirectorySourceRuleValues, readDirectorySourceRuleRecords } from './directory-source-rules';

interface RuleFormModel {
  value: string;
  matchMode: Api.AiLeads.DirectorySourceRuleMatchMode;
  enabled: boolean;
  description: string;
}

const defaultRuleForm: RuleFormModel = {
  value: '',
  matchMode: 'domain_suffix',
  enabled: true,
  description: ''
};

export function useAiLeadDirectorySourceRules() {
  const message = useMessage();
  const records = ref<Api.AiLeads.DirectorySourceRuleRecord[]>([]);
  const form = reactive<RuleFormModel>({ ...defaultRuleForm });
  const editingRuleId = shallowRef('');
  const deletingRuleId = shallowRef('');
  const isLoading = shallowRef(false);
  const isSaving = shallowRef(false);
  const isFormVisible = shallowRef(false);

  const customRecords = computed(() => records.value.filter(record => !record.builtin));
  const builtinRecords = computed(() => records.value.filter(record => record.builtin));
  const isEditingRule = computed(() => Boolean(editingRuleId.value));
  const ruleValues = computed(() => parseDirectorySourceRuleValues(form.value));
  const formTitle = computed(() => (editingRuleId.value ? '编辑过滤规则' : '新增过滤规则'));
  const canSubmit = computed(() => ruleValues.value.length > 0 && !isSaving.value);

  async function loadRules() {
    isLoading.value = true;

    try {
      const result = await fetchLeadDirectorySourceRules();
      const nextRecords = readDirectorySourceRuleRecords(result);

      if (nextRecords) {
        records.value = nextRecords;
      }
    } finally {
      isLoading.value = false;
    }
  }

  function openCreateForm() {
    resetForm();
    isFormVisible.value = true;
  }

  function openEditForm(record: Api.AiLeads.DirectorySourceRuleRecord) {
    if (record.builtin) {
      return;
    }

    editingRuleId.value = record.id;
    form.value = record.value;
    form.matchMode = record.matchMode;
    form.enabled = record.enabled;
    form.description = record.description ?? '';
    isFormVisible.value = true;
  }

  async function submitForm() {
    if (!canSubmit.value) {
      return;
    }

    isSaving.value = true;

    try {
      if (editingRuleId.value) {
        await updateLeadDirectorySourceRule(editingRuleId.value, toPayload(form, ruleValues.value[0]));
        message.success('过滤规则已更新');
      } else {
        for (const value of ruleValues.value) {
          await createLeadDirectorySourceRule(toPayload(form, value));
        }

        message.success(`已新增 ${ruleValues.value.length} 条过滤规则`);
      }

      isFormVisible.value = false;
      await loadRules();
    } finally {
      isSaving.value = false;
    }
  }

  async function removeRule(record: Api.AiLeads.DirectorySourceRuleRecord) {
    if (record.builtin) {
      return;
    }

    deletingRuleId.value = record.id;

    try {
      await deleteLeadDirectorySourceRule(record.id);
      message.success('过滤规则已删除');
      await loadRules();
    } finally {
      deletingRuleId.value = '';
    }
  }

  function resetForm() {
    editingRuleId.value = '';
    form.value = defaultRuleForm.value;
    form.matchMode = defaultRuleForm.matchMode;
    form.enabled = defaultRuleForm.enabled;
    form.description = defaultRuleForm.description;
  }

  return {
    builtinRecords,
    canSubmit,
    customRecords,
    deletingRuleId,
    form,
    formTitle,
    isEditingRule,
    isFormVisible,
    isLoading,
    isSaving,
    loadRules,
    openCreateForm,
    openEditForm,
    removeRule,
    resetForm,
    submitForm
  };
}

function toPayload(form: RuleFormModel, value = form.value): Api.AiLeads.SaveDirectorySourceRulePayload {
  return {
    value,
    matchMode: form.matchMode,
    enabled: form.enabled,
    description: form.description || null
  };
}
