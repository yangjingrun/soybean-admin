<script setup lang="ts">
import { watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useUserProfileForm } from './useUserProfileForm';

defineOptions({
  name: 'UserProfileModal'
});

const visible = defineModel<boolean>('show', { required: true });
const authStore = useAuthStore();
const { formRef, formModel, rules, submitting, resetForm, submit } = useUserProfileForm({
  onSuccess: () => {
    visible.value = false;
  }
});

watch(visible, show => {
  if (show) {
    resetForm();
  }
});
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="个人信息" class="user-profile-modal">
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="112"
      require-mark-placement="right-hanging"
    >
      <NFormItem label="登录账号">
        <NInput :value="authStore.userInfo.userName" disabled />
      </NFormItem>
      <NFormItem label="昵称/发信署名" path="nickName">
        <NInput v-model:value="formModel.nickName" clearable placeholder="请输入昵称" />
      </NFormItem>
      <NFormItem label="电话" path="phone">
        <NInput v-model:value="formModel.phone" clearable placeholder="请输入电话" />
      </NFormItem>
      <NFormItem label="邮箱" path="email">
        <NInput v-model:value="formModel.email" clearable placeholder="请输入邮箱" @keydown.enter="submit" />
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="submitting" @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="submit">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.user-profile-modal {
  width: min(480px, calc(100vw - 32px));
}
</style>
