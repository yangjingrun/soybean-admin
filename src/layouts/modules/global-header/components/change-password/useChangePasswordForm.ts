import { computed, reactive, shallowRef } from 'vue';
import type { FormRules } from 'naive-ui';
import { changeCurrentUserPassword } from '@/service/api';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';

interface ChangePasswordFormModel {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Manage current-user password form validation and submit state. */
export function useChangePasswordForm(options: { onSuccess: () => void }) {
  const { formRef, validate, restoreValidation } = useNaiveForm();
  const { createRequiredRule, patternRules, createConfirmPwdRule } = useFormRules();
  const submitting = shallowRef(false);
  const formModel = reactive(createDefaultChangePasswordFormModel());
  const rules = computed<FormRules>(() => ({
    oldPassword: [createRequiredRule('请输入原密码'), patternRules.pwd],
    newPassword: [createRequiredRule('请输入新密码'), patternRules.pwd],
    confirmPassword: createConfirmPwdRule(computed(() => formModel.newPassword))
  }));

  /** Reset fields and validation state for the next open. */
  function resetForm() {
    Object.assign(formModel, createDefaultChangePasswordFormModel());
    void restoreValidation();
  }

  /** Validate and submit a current-user password change. */
  async function submit() {
    await validate();
    submitting.value = true;

    try {
      const { error } = await changeCurrentUserPassword({
        oldPassword: formModel.oldPassword,
        newPassword: formModel.newPassword
      });

      if (error) {
        return;
      }

      window.$message?.success('密码修改成功');
      resetForm();
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

/** Create an empty change password form model. */
function createDefaultChangePasswordFormModel(): ChangePasswordFormModel {
  return {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
}
