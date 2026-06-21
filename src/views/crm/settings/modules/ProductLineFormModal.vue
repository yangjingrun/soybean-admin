<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMessage, type FormInst, type FormRules } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import { useAuthStore } from '@/store/modules/auth';
import { normalizeProductLinePayload, validateProductLineAiWritingConfig } from './shared';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.ProductLineFormModel>('modelValue', {
  required: true
});

const props = defineProps<{
  mode: 'create' | 'edit';
  canManageAiWritingConfig?: boolean;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  openPromptHistory: [];
  submit: [];
}>();

const formRef = ref<FormInst | null>(null);
const message = useMessage();
const authStore = useAuthStore();
const modalTitle = computed(() => (props.mode === 'edit' ? '编辑产品线' : '新增产品线'));
const canManageAiWritingConfig = computed(() => {
  if (typeof props.canManageAiWritingConfig === 'boolean') return props.canManageAiWritingConfig;

  return hasPermission(authStore.userInfo, 'crm:settings:assets:write');
});
const isAiWritingConfigReadonly = computed(() => !canManageAiWritingConfig.value);

const rules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: '请输入产品线',
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

/** Validate and normalize product line form before submit. */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  Object.assign(formModel.value, normalizeProductLinePayload(formModel.value));

  const aiWritingError = canManageAiWritingConfig.value
    ? validateProductLineAiWritingConfig(formModel.value.aiWritingConfig)
    : null;

  if (aiWritingError) {
    message.warning(aiWritingError);
    return;
  }

  emit('submit');
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="modalTitle" class="product-line-form-modal">
    <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" :label-width="116">
      <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
        <NGi span="24 m:12">
          <NFormItem label="产品线" path="name">
            <NInput v-model:value="formModel.name" clearable @keyup.enter="handleSubmit" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="目标客户">
            <NInput v-model:value="formModel.targetCustomerType" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="核心卖点">
            <NInput v-model:value="formModel.coreSellingPoints" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="MOQ">
            <NInput v-model:value="formModel.moq" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="交期">
            <NInput v-model:value="formModel.leadTime" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="付款方式">
            <NInput v-model:value="formModel.paymentTerms" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="认证">
            <NInput v-model:value="formModel.certifications" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="产品目录 URL">
            <NInput v-model:value="formModel.catalogUrl" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="官网 URL">
            <NInput v-model:value="formModel.websiteUrl" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="常见型号">
            <NInput v-model:value="formModel.commonModelsText" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NDivider class="my-2" />
          <NSpace align="center" justify="space-between" class="ai-writing-title">
            <NText strong>AI 写信配置</NText>
            <NButton v-if="mode === 'edit'" size="small" secondary @click="emit('openPromptHistory')">
              AI Prompt 历史
            </NButton>
          </NSpace>
        </NGi>

        <NGi span="24">
          <NSpace vertical :size="12">
            <NAlert v-if="isAiWritingConfigReadonly" type="info" :bordered="false">
              普通成员仅可查看 AI 写信配置，修改请联系组织管理员。
            </NAlert>

            <NSpace align="center" justify="space-between">
              <NText>启用产品线 AI 写信</NText>
              <NSwitch v-model:value="formModel.aiWritingConfig.enabled" :disabled="isAiWritingConfigReadonly" />
            </NSpace>

            <NGrid v-if="formModel.aiWritingConfig.enabled" :cols="24" :x-gap="12" responsive="screen" item-responsive>
              <NGi span="24">
                <NFormItem label="通用要求">
                  <NInput
                    v-model:value="formModel.aiWritingConfig.commonRequirements"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :disabled="isAiWritingConfigReadonly"
                    placeholder="例如：英文自然商务语气，控制在 120 词内，不要像群发邮件"
                  />
                </NFormItem>
              </NGi>

              <NGi span="24">
                <NFormItem label="禁止内容">
                  <NInput
                    v-model:value="formModel.aiWritingConfig.forbiddenClaims"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :disabled="isAiWritingConfigReadonly"
                    placeholder="例如：不承诺最低价，不编造认证，不写未确认交期"
                  />
                </NFormItem>
              </NGi>

              <NGi span="24">
                <NFormItem label="产品重点">
                  <NInput
                    v-model:value="formModel.aiWritingConfig.productEmphasis"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :disabled="isAiWritingConfigReadonly"
                    placeholder="例如：优先强调库存型号、快速报价、稳定交付"
                  />
                </NFormItem>
              </NGi>

              <NGi span="24">
                <NTabs type="segment" animated>
                  <NTabPane
                    v-for="step in formModel.aiWritingConfig.steps"
                    :key="step.stepIndex"
                    :name="String(step.stepIndex)"
                    :tab="`第 ${step.stepIndex} 封`"
                  >
                    <NInput
                      v-model:value="step.prompt"
                      type="textarea"
                      :autosize="{ minRows: 4, maxRows: 7 }"
                      :disabled="isAiWritingConfigReadonly"
                      :placeholder="`配置第 ${step.stepIndex} 封开发信的 AI 写法`"
                    />
                  </NTabPane>
                </NTabs>
              </NGi>
            </NGrid>
          </NSpace>
        </NGi>
      </NGrid>
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
.product-line-form-modal {
  width: min(760px, calc(100vw - 32px));
}

.ai-writing-title {
  margin-bottom: 8px;
}
</style>
