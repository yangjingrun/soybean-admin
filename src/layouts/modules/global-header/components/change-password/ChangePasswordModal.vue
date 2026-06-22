<script setup lang="ts">
import { watch } from 'vue';
import { useChangePasswordForm } from './useChangePasswordForm';

defineOptions({
  name: 'ChangePasswordModal'
});

const visible = defineModel<boolean>('show', { required: true });

const { formRef, formModel, rules, submitting, resetForm, submit } = useChangePasswordForm({
  onSuccess: () => {
    visible.value = false;
  }
});

watch(visible, show => {
  if (!show) {
    resetForm();
  }
});
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="修改密码" class="change-password-modal">
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="88"
      require-mark-placement="right-hanging"
    >
      <NFormItem label="原密码" path="oldPassword">
        <NInput
          v-model:value="formModel.oldPassword"
          type="password"
          show-password-on="click"
          clearable
          placeholder="请输入原密码"
        />
      </NFormItem>
      <NFormItem label="新密码" path="newPassword">
        <NInput
          v-model:value="formModel.newPassword"
          type="password"
          show-password-on="click"
          clearable
          placeholder="6-18 位字母、数字或下划线"
        />
      </NFormItem>
      <NFormItem label="确认密码" path="confirmPassword">
        <NInput
          v-model:value="formModel.confirmPassword"
          type="password"
          show-password-on="click"
          clearable
          placeholder="请再次输入新密码"
          @keydown.enter="submit"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="submitting" @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="submit">确认修改</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.change-password-modal {
  width: min(440px, calc(100vw - 32px));
}
</style>
