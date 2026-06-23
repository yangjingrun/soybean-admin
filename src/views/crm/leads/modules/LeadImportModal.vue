<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FormInst, FormRules } from 'naive-ui';
import { normalizeLeadImportPayload } from './shared';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.LeadImportFormModel>('modelValue', { required: true });

defineProps<{
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: Api.Crm.LeadImportPayload];
}>();

const formRef = ref<FormInst | null>(null);
const rules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: '请输入公司名称',
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

/** Validate and submit one manual CRM lead import payload. */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  emit('submit', normalizeLeadImportPayload(formModel.value));
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="新增客户" class="lead-import-modal">
    <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" :label-width="96">
      <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
        <NGi span="24 m:12">
          <NFormItem label="公司名称" path="name">
            <NInput v-model:value="formModel.name" clearable @keyup.enter="handleSubmit" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="官网">
            <NInput v-model:value="formModel.websiteUrl" clearable placeholder="https://example.com" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="地区">
            <NInputGroup>
              <NInput v-model:value="formModel.country" clearable placeholder="国家/地区" />
              <NInput v-model:value="formModel.city" clearable placeholder="城市" />
            </NInputGroup>
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="地址">
            <NInput v-model:value="formModel.address" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="时区">
            <NInput v-model:value="formModel.timeZone" clearable placeholder="留空自动识别，如 Asia/Riyadh" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="客户类型">
            <NInput v-model:value="formModel.customerType" clearable placeholder="importer / distributor / retailer" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NDivider class="lead-import-divider">联系人</NDivider>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="姓名">
            <NInput v-model:value="formModel.contactFullName" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="职位">
            <NInput v-model:value="formModel.contactTitle" clearable />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="邮箱">
            <NInput v-model:value="formModel.contactEmail" clearable placeholder="name@example.com" />
          </NFormItem>
        </NGi>
      </NGrid>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="submitting" @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">导入</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.lead-import-modal {
  width: min(720px, calc(100vw - 32px));
}

.lead-import-divider {
  margin: 4px 0 16px;
}
</style>
