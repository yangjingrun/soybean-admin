<script setup lang="ts">
defineProps<{
  accountOptions: Array<{ label: string; value: string }>;
  contactOptions: Array<{ label: string; value: string }>;
  loading?: boolean;
  mailboxOptions: Array<{ label: string; value: string }>;
  productLineOptions: Array<{ label: string; value: string }>;
  sequencePolicyOptions: Array<{ label: string; value: string }>;
  submitting?: boolean;
}>();

const show = defineModel<boolean>('show', { required: true });
const formModel = defineModel<Api.Crm.SequenceReviewCreateFormModel>('formModel', { required: true });

const emit = defineEmits<{
  accountChange: [accountId: string | null];
  submit: [];
}>();
</script>

<template>
  <NModal v-model:show="show" preset="card" title="生成首封草稿" class="max-w-560px">
    <NSpin :show="loading">
      <NForm :model="formModel" label-placement="top">
        <NFormItem label="线索">
          <NSelect
            :value="formModel.accountId"
            filterable
            clearable
            :options="accountOptions"
            placeholder="选择 CRM 线索"
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
          <NSelect
            v-model:value="formModel.productLineId"
            filterable
            clearable
            :options="productLineOptions"
            placeholder="可选，建议选择"
          />
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
        <NFormItem label="序列策略">
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
        <NButton type="primary" :loading="submitting" @click="emit('submit')">生成草稿</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
