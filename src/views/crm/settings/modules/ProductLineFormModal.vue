<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FormInst, FormRules } from 'naive-ui';
import { normalizeProductLinePayload } from './shared';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.ProductLineFormModel>('modelValue', {
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
const modalTitle = computed(() => (props.mode === 'edit' ? '编辑产品线' : '新增产品线'));

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
</style>
