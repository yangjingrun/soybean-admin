<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FormInst, FormRules } from 'naive-ui';
import { normalizePersonaProfilePayload } from './shared';

const visible = defineModel<boolean>('visible', { required: true });
const formModel = defineModel<Api.Crm.PersonaProfileFormModel>('modelValue', {
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
const modalTitle = computed(() => (props.mode === 'edit' ? '编辑画像' : '新增画像'));

const rules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: '请输入画像名称',
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

/** Validate and normalize persona profile form before submit. */
async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  Object.assign(formModel.value, normalizePersonaProfilePayload(formModel.value));
  emit('submit');
}
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="modalTitle" class="persona-profile-form-modal">
    <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" :label-width="116">
      <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
        <NGi span="24 m:12">
          <NFormItem label="画像名称" path="name">
            <NInput v-model:value="formModel.name" clearable @keyup.enter="handleSubmit" />
          </NFormItem>
        </NGi>

        <NGi span="24 m:12">
          <NFormItem label="默认画像">
            <NSwitch v-model:value="formModel.isDefault" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="描述">
            <NInput v-model:value="formModel.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="职位关键词">
            <NInput
              v-model:value="formModel.titleKeywordsText"
              type="textarea"
              placeholder="例如 procurement、buyer，可换行"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="客户类型">
            <NInput
              v-model:value="formModel.customerTypeKeywordsText"
              type="textarea"
              placeholder="例如 distributor、wholesaler，可换行"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="痛点">
            <NInput v-model:value="formModel.painPoints" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="关注点">
            <NInput v-model:value="formModel.focusText" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </NFormItem>
        </NGi>

        <NGi span="24">
          <NFormItem label="避让说明">
            <NInput v-model:value="formModel.avoidText" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
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
.persona-profile-form-modal {
  width: min(760px, calc(100vw - 32px));
}
</style>
