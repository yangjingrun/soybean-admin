import { computed, reactive, shallowRef } from 'vue';
import type { FormRules } from 'naive-ui';
import { REG_EMAIL, REG_PHONE } from '@/constants/reg';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { useAuthStore } from '@/store/modules/auth';

interface UserProfileFormModel {
  nickName: string;
  phone: string;
  email: string;
}

/** Manage current-user profile form state and persistence. */
export function useUserProfileForm(options: { onSuccess: () => void }) {
  const authStore = useAuthStore();
  const { formRef, validate, restoreValidation } = useNaiveForm();
  const { patternRules } = useFormRules();
  const submitting = shallowRef(false);
  const formModel = reactive(createProfileFormModel(authStore.userInfo));
  const rules = computed<FormRules>(() => ({
    phone: [createOptionalPatternRule(REG_PHONE, patternRules.phone.message)],
    email: [createOptionalPatternRule(REG_EMAIL, patternRules.email.message)]
  }));

  /** Reset profile fields from the latest authenticated user snapshot. */
  function resetForm() {
    Object.assign(formModel, createProfileFormModel(authStore.userInfo));
    void restoreValidation();
  }

  /** Validate and persist the current user's editable profile. */
  async function submit() {
    await validate();
    submitting.value = true;

    try {
      const pass = await authStore.updateProfile({
        nickName: normalizeProfileText(formModel.nickName),
        phone: normalizeProfileText(formModel.phone),
        email: normalizeProfileText(formModel.email)
      });

      if (!pass) {
        return;
      }

      window.$message?.success('个人信息已保存');
      options.onSuccess();
    } finally {
      submitting.value = false;
    }
  }

  return {
    formRef,
    formModel,
    rules,
    submitting,
    resetForm,
    submit
  };
}

/** Create a string-only form model from nullable user profile fields. */
function createProfileFormModel(userInfo: Api.Auth.UserInfo): UserProfileFormModel {
  return {
    nickName: userInfo.nickName || '',
    phone: userInfo.phone || '',
    email: userInfo.email || ''
  };
}

function normalizeProfileText(value: string) {
  const normalized = value.trim();

  return normalized || null;
}

function createOptionalPatternRule(pattern: RegExp, message: string): App.Global.FormRule {
  return {
    validator: (_rule, value: string | null | undefined) => {
      if (!value) {
        return true;
      }

      return pattern.test(value);
    },
    message,
    trigger: 'change'
  };
}
