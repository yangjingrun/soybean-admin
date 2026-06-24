<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMessage, type FormInst, type FormRules } from 'naive-ui';
import { hasPermission } from '@soybean/shared';
import { useAuthStore } from '@/store/modules/auth';
import {
  normalizeProductLinePayload,
  productLineAiCtaPreferenceOptions,
  productLineAiLanguagePolicyOptions,
  productLineAiPolishPolicyOptions,
  productLineAiSequenceStrategyOptions,
  productLineAiToneOptions,
  validateProductLineAiWritingConfig
} from './shared';

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
const drawerTitle = computed(() => (props.mode === 'edit' ? '编辑产品线' : '新增产品线'));
const productLinePlaceholders = {
  name: '例如：轴承、工业轴承系列、OEM 机械配件；写客户能看懂的产品分类',
  targetCustomerType: '例如：进口商、经销商、OEM 采购、设备维修商、工业品分销商',
  coreSellingPoints: '例如：写主要产品型号、核心优势、适用场景、库存/定制/报价能力',
  moq: '例如：按型号和库存确认，常规型号可小批量起订',
  leadTime: '例如：现货 3-7 天，定制或大批量订单按生产排期确认',
  paymentTerms: '例如：T/T、样品单可协商',
  certifications: '例如：ISO 9001，可按市场要求提供检测报告或材质证明',
  catalogUrl: '例如：https://example.com/catalog.pdf',
  websiteUrl: '例如：https://www.example.com',
  commonModelsText: '例如：6000/6200/6300 系列；302/303/322 系列；UC/UCP 外球面轴承'
} as const;
const aiSelectPlaceholder = '不选默认使用系统内置';
const aiPromptPlaceholder = '留空默认使用系统内置写法';
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
  <NDrawer v-model:show="visible" :width="760" placement="right">
    <NDrawerContent :title="drawerTitle" closable>
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" :label-width="116">
        <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
          <NGi span="24 m:12">
            <NFormItem label="产品线" path="name">
              <NInput
                v-model:value="formModel.name"
                clearable
                :placeholder="productLinePlaceholders.name"
                @keyup.enter="handleSubmit"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="目标客户">
              <NInput
                v-model:value="formModel.targetCustomerType"
                clearable
                :placeholder="productLinePlaceholders.targetCustomerType"
              />
            </NFormItem>
          </NGi>

          <NGi span="24">
            <NFormItem label="核心卖点">
              <NInput
                v-model:value="formModel.coreSellingPoints"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 5 }"
                :placeholder="productLinePlaceholders.coreSellingPoints"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="MOQ">
              <NInput v-model:value="formModel.moq" clearable :placeholder="productLinePlaceholders.moq" />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="交期">
              <NInput v-model:value="formModel.leadTime" clearable :placeholder="productLinePlaceholders.leadTime" />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="付款方式">
              <NInput
                v-model:value="formModel.paymentTerms"
                clearable
                :placeholder="productLinePlaceholders.paymentTerms"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="认证">
              <NInput
                v-model:value="formModel.certifications"
                clearable
                :placeholder="productLinePlaceholders.certifications"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="产品目录 URL">
              <NInput
                v-model:value="formModel.catalogUrl"
                clearable
                :placeholder="productLinePlaceholders.catalogUrl"
              />
            </NFormItem>
          </NGi>

          <NGi span="24 m:12">
            <NFormItem label="官网 URL">
              <NInput
                v-model:value="formModel.websiteUrl"
                clearable
                :placeholder="productLinePlaceholders.websiteUrl"
              />
            </NFormItem>
          </NGi>

          <NGi span="24">
            <NFormItem label="常见型号">
              <NInput
                v-model:value="formModel.commonModelsText"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 5 }"
                :placeholder="productLinePlaceholders.commonModelsText"
              />
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

              <NGrid
                v-if="formModel.aiWritingConfig.enabled"
                :cols="24"
                :x-gap="12"
                responsive="screen"
                item-responsive
              >
                <NGi span="24 m:12">
                  <NFormItem label="序列策略">
                    <NSelect
                      v-model:value="formModel.aiWritingConfig.sequenceStrategy"
                      :options="productLineAiSequenceStrategyOptions"
                      :disabled="isAiWritingConfigReadonly"
                      clearable
                      :placeholder="aiSelectPlaceholder"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24 m:12">
                  <NFormItem label="语言策略">
                    <NSelect
                      v-model:value="formModel.aiWritingConfig.languagePolicy"
                      :options="productLineAiLanguagePolicyOptions"
                      :disabled="isAiWritingConfigReadonly"
                      clearable
                      :placeholder="aiSelectPlaceholder"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24 m:8">
                  <NFormItem label="语气">
                    <NSelect
                      v-model:value="formModel.aiWritingConfig.tone"
                      :options="productLineAiToneOptions"
                      :disabled="isAiWritingConfigReadonly"
                      clearable
                      :placeholder="aiSelectPlaceholder"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24 m:8">
                  <NFormItem label="CTA">
                    <NSelect
                      v-model:value="formModel.aiWritingConfig.ctaPreference"
                      :options="productLineAiCtaPreferenceOptions"
                      :disabled="isAiWritingConfigReadonly"
                      clearable
                      :placeholder="aiSelectPlaceholder"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24 m:8">
                  <NFormItem label="润色">
                    <NSelect
                      v-model:value="formModel.aiWritingConfig.polishPolicy"
                      :options="productLineAiPolishPolicyOptions"
                      :disabled="isAiWritingConfigReadonly"
                      clearable
                      :placeholder="aiSelectPlaceholder"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24">
                  <NFormItem label="证据素材">
                    <NInput
                      v-model:value="formModel.aiWritingConfig.proofAssets"
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                      :disabled="isAiWritingConfigReadonly"
                      placeholder="留空默认使用系统内置；例如：可公开使用的客户类型、认证、交付记录或案例素材"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24">
                  <NFormItem label="地区备注">
                    <NInput
                      v-model:value="formModel.aiWritingConfig.regionNotes"
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                      :disabled="isAiWritingConfigReadonly"
                      placeholder="留空默认使用系统内置；例如：特定地区常见采购关注点、表达偏好或需避开的说法"
                    />
                  </NFormItem>
                </NGi>

                <NGi span="24">
                  <NTabs type="segment" class="product-line-prompt-tabs">
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
                        :placeholder="`第 ${step.stepIndex} 封：${aiPromptPlaceholder}`"
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
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.ai-writing-title {
  margin-bottom: 8px;
}
</style>
