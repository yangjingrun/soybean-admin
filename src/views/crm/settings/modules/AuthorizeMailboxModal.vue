<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FormInst, FormRules } from 'naive-ui';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.MailboxAuthorizeFormModel>('modelValue', {
  required: true
});

defineProps<{
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const formRef = ref<FormInst | null>(null);
const normalizedEmail = computed(() => formModel.value.emailAddress.trim().toLowerCase());
const rules = reactive<FormRules>({
  emailAddress: [
    {
      required: true,
      message: '请输入 Gmail 地址',
      trigger: ['input', 'blur']
    },
    { type: 'email', message: '邮箱格式不正确', trigger: ['input', 'blur'] },
    {
      validator: () => normalizedEmail.value.endsWith('@gmail.com'),
      message: '请输入 Gmail 地址',
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

/** Validate the authorization form before calling the mocked endpoint. */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  formModel.value.emailAddress = normalizedEmail.value;
  emit('submit');
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="新增授权" class="authorize-mailbox-modal">
    <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" :label-width="92">
      <NFormItem label="Gmail 地址" path="emailAddress">
        <NInput
          v-model:value="formModel.emailAddress"
          clearable
          placeholder="name@gmail.com"
          @keyup.enter="handleSubmit"
        />
      </NFormItem>
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
.authorize-mailbox-modal {
  width: min(520px, calc(100vw - 32px));
}
</style>
