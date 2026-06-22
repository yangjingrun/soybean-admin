<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { getProductLineAiWritingStatus } from '../../settings/modules/shared';

interface ProductLineSelectOption extends SelectOption {
  value: string;
  aiWritingConfig?: Api.Crm.ProductLineAiWritingConfig | null;
}

const props = defineProps<{
  accountOptions: Array<{ label: string; value: string }>;
  contactOptions: Array<{ label: string; value: string }>;
  loading?: boolean;
  mailboxOptions: Array<{ label: string; value: string }>;
  productLineOptions: ProductLineSelectOption[];
  sequencePolicyOptions: Array<{ label: string; value: string }>;
  submitting?: boolean;
}>();

const show = defineModel<boolean>('show', { required: true });
const formModel = defineModel<Api.Crm.SequenceReviewCreateFormModel>('formModel', { required: true });

const emit = defineEmits<{
  accountChange: [accountId: string | null];
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
</script>

<template>
  <NModal v-model:show="show" preset="card" title="生成首封开发信草稿" class="max-w-560px">
    <NSpin :show="loading">
      <NForm :model="formModel" label-placement="top">
        <NFormItem label="客户">
          <NSelect
            :value="formModel.accountId"
            filterable
            clearable
            :options="accountOptions"
            placeholder="选择 CRM 客户"
            @update:value="emit('accountChange', $event)"
          />
        </NFormItem>
        <NFormItem label="联系人">
          <NSelect
            v-model:value="formModel.contactId"
            filterable
            clearable
            :disabled="!formModel.accountId"
            :options="contactOptions"
            placeholder="选择联系人"
          />
        </NFormItem>
        <NFormItem label="产品线">
          <NSpace vertical :size="8" class="w-full">
            <NSelect
              v-model:value="formModel.productLineId"
              filterable
              clearable
              :options="productLineOptions"
              placeholder="可选，建议选择"
            />
            <NSpace v-if="selectedProductLineAiWritingStatus" align="center" :size="8">
              <NText depth="3">AI 状态</NText>
              <NTag size="small" :type="selectedProductLineAiWritingStatus.tagType" :bordered="false">
                {{ selectedProductLineAiWritingStatus.label }}
              </NTag>
            </NSpace>
          </NSpace>
        </NFormItem>
        <NFormItem label="发送邮箱">
          <NSelect
            v-model:value="formModel.mailboxId"
            filterable
            clearable
            :options="mailboxOptions"
            placeholder="可选，后续发送前仍会校验"
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
    </NSpin>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="show = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="emit('submit')">生成开发信草稿</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
