<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FormInst, FormRules } from 'naive-ui';
import { emailTemplateThreadModeOptions, normalizeEmailTemplatePayload } from './shared';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.EmailTemplateFormModel>('modelValue', {
  required: true
});

const props = defineProps<{
  mode: 'create' | 'edit';
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const formRef = ref<FormInst | null>(null);
const modalTitle = computed(() => (props.mode === 'edit' ? '编辑邮件模板' : '新增邮件模板'));

const rules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: '请输入模板名称',
      trigger: ['input', 'blur']
    }
  ],
  language: [
    {
      required: true,
      message: '请输入语言标识',
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

/** Validate and normalize the five-step email template before submit. */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  Object.assign(formModel.value, normalizeEmailTemplatePayload(formModel.value));
  emit('submit');
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="modalTitle" class="email-template-form-modal">
    <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="small">
      <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
        <NGi span="24 m:12">
          <NFormItem label="模板名称" path="name">
            <NInput v-model:value="formModel.name" clearable placeholder="例如：默认英文五步跟进" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="语言" path="language">
            <NInput v-model:value="formModel.language" placeholder="en" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="描述">
            <NInput
              v-model:value="formModel.description"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="用于区分模板适用场景"
            />
          </NFormItem>
        </NGi>
      </NGrid>

      <NSpace vertical :size="12">
        <section v-for="step in formModel.steps" :key="step.stepIndex" class="template-step-panel">
          <div class="template-step-header">
            <NTag :bordered="false" type="info" size="small">第 {{ step.stepIndex }} 封</NTag>
            <span class="template-step-title">{{ step.name || `第 ${step.stepIndex} 封` }}</span>
          </div>

          <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
            <NGi span="24 m:8">
              <NFormItem label="步骤名称">
                <NInput v-model:value="step.name" placeholder="例如：首封开发信" />
              </NFormItem>
            </NGi>

            <NGi span="24 m:8">
              <NFormItem label="线程方式">
                <NSelect v-model:value="step.threadMode" :options="emailTemplateThreadModeOptions" />
              </NFormItem>
            </NGi>

            <NGi span="24 m:8">
              <NFormItem label="延迟天数">
                <NInputNumber
                  v-model:value="step.delayDays"
                  :disabled="step.stepIndex === 1"
                  :min="0"
                  :max="90"
                  class="template-number-input"
                />
              </NFormItem>
            </NGi>

            <NGi span="24">
              <NFormItem label="邮件主题">
                <NInput v-model:value="step.subjectTemplate" placeholder="同线程跟进可留空" />
              </NFormItem>
            </NGi>

            <NGi span="24">
              <NFormItem label="正文模板">
                <NInput
                  v-model:value="step.bodyTemplate"
                  type="textarea"
                  :autosize="{ minRows: 5, maxRows: 8 }"
                  placeholder="支持 {{contact.name}}、{{account.name}}、{{product.name}} 等变量"
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
.email-template-form-modal {
  width: min(920px, calc(100vw - 32px));
}

.template-step-panel {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.template-step-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.template-step-title {
  color: var(--n-text-color);
  font-weight: 500;
}

.template-number-input {
  width: 100%;
}
</style>
