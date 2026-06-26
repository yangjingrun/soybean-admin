<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { getProductLineAiWritingStatus } from '../../settings/modules/shared';
import type { LeadSequenceTarget } from './shared';

interface ProductLineSelectOption extends SelectOption {
  value: string;
  aiWritingConfig?: Api.Crm.ProductLineAiWritingConfig | null;
}

const props = defineProps<{
  loading?: boolean;
  mailboxOptions: Array<{ label: string; value: string }>;
  productLineOptions: ProductLineSelectOption[];
  sequencePolicyOptions: Array<{ label: string; value: string }>;
  submitting?: boolean;
  targets: LeadSequenceTarget[];
}>();

const show = defineModel<boolean>('show', { required: true });
const formModel = defineModel<Api.Crm.SequenceReviewCreateFormModel>('formModel', { required: true });

const emit = defineEmits<{
  submit: [];
}>();

const selectedProductLineOption = computed(() =>
  props.productLineOptions.find(option => option.value === formModel.value.productLineId)
);
const selectedProductLineAiWritingStatus = computed(() =>
  selectedProductLineOption.value
    ? getProductLineAiWritingStatus(selectedProductLineOption.value.aiWritingConfig)
    : null
);
const sourceProductLineNames = computed(() =>
  Array.from(new Set(props.targets.map(target => target.sourceProductLineName).filter(Boolean)))
);
const hasTargetsWithoutSourceProductLine = computed(() => props.targets.some(target => !target.sourceProductLineId));
const hasSingleCompleteSourceProductLine = computed(
  () => props.targets.length > 0 && !hasTargetsWithoutSourceProductLine.value && sourceProductLineNames.value.length === 1
);
const modalTitle = computed(() => (props.targets.length > 1 ? '批量生成开发信' : '生成开发信'));
</script>

<template>
  <NModal v-model:show="show" preset="card" :title="modalTitle" class="lead-sequence-modal">
    <NSpin :show="loading">
      <NSpace vertical :size="14">
        <div class="target-count">
          <span class="target-count-label">已选择</span>
          <NTag :bordered="false" size="small" type="info">{{ targets.length }} 个联系人</NTag>
          <NTag
            v-if="hasSingleCompleteSourceProductLine"
            :bordered="false"
            size="small"
            type="success"
          >
            来源产品线：{{ sourceProductLineNames[0] }}
          </NTag>
          <NTag v-else-if="sourceProductLineNames.length > 1" :bordered="false" size="small" type="warning">
            多产品线
          </NTag>
          <NTag v-else-if="hasTargetsWithoutSourceProductLine && sourceProductLineNames.length" :bordered="false" size="small" type="warning">
            部分无来源产品线
          </NTag>
        </div>

        <NForm :model="formModel" label-placement="top">
          <NFormItem label="产品线">
            <NSpace vertical :size="8" class="w-full">
              <NSelect
                v-model:value="formModel.productLineId"
                filterable
                clearable
                :options="productLineOptions"
                placeholder="默认按来源产品线，可手动调整"
              />
              <NSpace v-if="selectedProductLineAiWritingStatus" align="center" :size="8">
                <NText depth="3">AI 状态</NText>
                <NTag size="small" :type="selectedProductLineAiWritingStatus.tagType" :bordered="false">
                  {{ selectedProductLineAiWritingStatus.label }}
                </NTag>
              </NSpace>
            </NSpace>
          </NFormItem>
          <NFormItem label="发送邮箱" required>
            <NSelect
              v-model:value="formModel.mailboxId"
              filterable
              :options="mailboxOptions"
              placeholder="选择发送邮箱"
            />
          </NFormItem>
          <NFormItem label="跟进策略">
            <NSelect
              v-model:value="formModel.policyId"
              filterable
              clearable
              :options="sequencePolicyOptions"
              placeholder="可选，默认使用组织默认策略"
            />
          </NFormItem>
        </NForm>
      </NSpace>
    </NSpin>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="show = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="emit('submit')">
          确认并后台生成 {{ targets.length }} 封
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.lead-sequence-modal {
  width: min(640px, calc(100vw - 32px));
}

.target-count {
  display: flex;
  align-items: center;
  gap: 10px;
}

.target-count-label {
  color: var(--n-text-color-3);
}
</style>
