<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import type { FormInst, FormRules } from 'naive-ui';
import {
  emailTemplateThreadModeOptions,
  normalizeSequencePolicyPayload,
  sequencePolicyLinkPolicyOptions,
  sequencePolicySameCompanyStrategyOptions
} from './shared';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.SequencePolicyFormModel>('modelValue', {
  required: true
});

const props = defineProps<{
  mode: 'create' | 'edit';
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const message = useMessage();
const formRef = ref<FormInst | null>(null);
const modalTitle = computed(() => (props.mode === 'edit' ? '编辑序列策略' : '新增序列策略'));

const rules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: '请输入策略名称',
      trigger: ['input', 'blur']
    }
  ]
});

watch(
  () => visible.value,
  show => {
    if (show) {
      formRef.value?.restoreValidation();
    }
  }
);

/** Validate and normalize the five-step sequence policy before submit. */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  if (!formModel.value.steps.every(isValidPolicyStep)) {
    message.error('请确认第 2-5 封延迟天数为 1-90 的整数');
    return;
  }

  Object.assign(formModel.value, normalizeSequencePolicyPayload(formModel.value));
  emit('submit');
}

function isValidPolicyStep(step: Api.Crm.SequencePolicyStep) {
  if (step.stepIndex === 1) {
    return step.delayDays === 0;
  }

  return Number.isInteger(step.delayDays) && step.delayDays >= 1 && step.delayDays <= 90;
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="modalTitle" class="sequence-policy-form-modal">
    <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="small">
      <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
        <NGi span="24 m:12">
          <NFormItem label="策略名称" path="name">
            <NInput v-model:value="formModel.name" clearable placeholder="例如：保守五步跟进" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="默认策略">
            <NSwitch v-model:value="formModel.isDefault">
              <template #checked>设为默认</template>
              <template #unchecked>普通策略</template>
            </NSwitch>
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="描述">
            <NInput
              v-model:value="formModel.description"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="用于区分策略适用场景"
            />
          </NFormItem>
        </NGi>

        <NGi span="24 m:8">
          <NFormItem label="链接策略">
            <NSelect v-model:value="formModel.linkPolicy" :options="sequencePolicyLinkPolicyOptions" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:8">
          <NFormItem label="同公司策略">
            <NSelect
              v-model:value="formModel.sameCompanyContactStrategy"
              :options="sequencePolicySameCompanyStrategyOptions"
            />
          </NFormItem>
        </NGi>

        <NGi span="24 m:8">
          <NFormItem label="低风险自动发送">
            <NSwitch v-model:value="formModel.allowLowRiskAutoSend">
              <template #checked>允许</template>
              <template #unchecked>不允许</template>
            </NSwitch>
          </NFormItem>
        </NGi>
      </NGrid>

      <NSpace vertical :size="12">
        <section v-for="step in formModel.steps" :key="step.stepIndex" class="policy-step-panel">
          <div class="policy-step-header">
            <NTag :bordered="false" type="info" size="small">第 {{ step.stepIndex }} 封</NTag>
            <span class="policy-step-title">
              {{ step.stepIndex === 1 ? '首封立即生成' : `发送前等待 ${step.delayDays ?? 0} 天` }}
            </span>
          </div>

          <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
            <NGi span="24 m:12">
              <NFormItem label="线程方式">
                <NSelect v-model:value="step.threadMode" :options="emailTemplateThreadModeOptions" />
              </NFormItem>
            </NGi>

            <NGi span="24 m:12">
              <NFormItem label="延迟天数">
                <NInputNumber
                  v-model:value="step.delayDays"
                  :disabled="step.stepIndex === 1"
                  :min="step.stepIndex === 1 ? 0 : 1"
                  :max="90"
                  class="policy-number-input"
                />
              </NFormItem>
            </NGi>
          </NGrid>
        </section>
      </NSpace>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="submitting" @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">提交</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.sequence-policy-form-modal {
  width: min(820px, calc(100vw - 32px));
}

.policy-step-panel {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.policy-step-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.policy-step-title {
  color: var(--n-text-color);
  font-weight: 500;
}

.policy-number-input {
  width: 100%;
}
</style>
