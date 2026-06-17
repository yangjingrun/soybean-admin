<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useImageCaptcha } from '@/hooks/business/image-captcha';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'PwdLogin'
});

const authStore = useAuthStore();
const { formRef, validate } = useNaiveForm();
const { captchaId, captchaImageSrc, loading: captchaLoading, refreshCaptcha } = useImageCaptcha();

interface FormModel {
  userName: string;
  password: string;
  captchaCode: string;
}

const model: FormModel = reactive({
  userName: 'Soybean',
  password: '123456',
  captchaCode: ''
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  // Keep image captcha validation local because it accepts letters + numbers.
  const { createRequiredRule, formRules } = useFormRules();

  return {
    userName: formRules.userName,
    password: formRules.pwd,
    captchaCode: [
      createRequiredRule($t('form.code.required')),
      {
        pattern: /^[a-zA-Z0-9]{6}$/,
        message: $t('form.code.invalid'),
        trigger: 'change'
      }
    ]
  };
});

const canSubmit = computed(() => {
  return Boolean(model.userName && model.password && model.captchaCode && captchaId.value);
});

async function handleSubmit() {
  await validate();
  await authStore.login(model.userName, model.password, captchaId.value, model.captchaCode);
  model.captchaCode = '';

  if (!authStore.isLogin) {
    await refreshCaptcha();
  }
}

onMounted(refreshCaptcha);
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
    <NFormItem path="userName">
      <NInput v-model:value="model.userName" :placeholder="$t('page.login.common.userNamePlaceholder')" />
    </NFormItem>
    <NFormItem path="password">
      <NInput
        v-model:value="model.password"
        type="password"
        show-password-on="click"
        :placeholder="$t('page.login.common.passwordPlaceholder')"
      />
    </NFormItem>
    <NFormItem path="captchaCode">
      <div class="w-full flex-y-center gap-12px">
        <NInput
          v-model:value="model.captchaCode"
          :maxlength="6"
          :placeholder="$t('page.login.common.codePlaceholder')"
        />
        <NButton class="h-40px w-118px overflow-hidden !p-0" :loading="captchaLoading" @click="refreshCaptcha">
          <img
            v-if="captchaImageSrc"
            class="h-full w-full cursor-pointer object-cover"
            :src="captchaImageSrc"
            alt="captcha"
          />
        </NButton>
      </div>
    </NFormItem>
    <NSpace vertical :size="24">
      <NButton
        type="primary"
        size="large"
        round
        block
        :disabled="!canSubmit"
        :loading="authStore.loginLoading"
        @click="handleSubmit"
      >
        {{ $t('common.confirm') }}
      </NButton>
    </NSpace>
  </NForm>
</template>

<style scoped></style>
