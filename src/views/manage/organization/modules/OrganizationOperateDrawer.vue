<script setup lang="ts">
import { computed, nextTick, reactive, watch } from 'vue';
import type { FormRules } from 'naive-ui';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { organizationStatusOptions } from './shared';

type OperateType = 'add' | 'edit';

interface OrganizationOperateFormModel {
  name: string;
  status: Api.SystemOrganization.OrganizationStatus;
}

const drawerVisible = defineModel<boolean>('show', { required: true });

const props = defineProps<{
  loading?: boolean;
  operateType: OperateType;
  row: Api.SystemOrganization.OrganizationListItem | null;
}>();

const emit = defineEmits<{
  submit: [payload: Api.SystemOrganization.OrganizationOperatePayload];
}>();

const { formRef, restoreValidation, validate } = useNaiveForm();
const { createRequiredRule } = useFormRules();
const formModel = reactive<OrganizationOperateFormModel>(createDefaultFormModel());

const drawerTitle = computed(() => (props.operateType === 'add' ? '新增组织' : '编辑组织'));

const rules: FormRules = {
  name: [createRequiredRule('请输入组织名称')],
  status: [createRequiredRule('请选择状态')]
};

watch(
  () => drawerVisible.value,
  visible => {
    if (!visible) {
      return;
    }

    Object.assign(formModel, props.operateType === 'add' ? createDefaultFormModel() : createFormModelFromRow(props.row));
    void nextTick(restoreValidation);
  }
);

/** Create an empty organization form model. */
function createDefaultFormModel(): OrganizationOperateFormModel {
  return {
    name: '',
    status: 'enabled'
  };
}

/** Convert table row data into the drawer form model. */
function createFormModelFromRow(row: Api.SystemOrganization.OrganizationListItem | null): OrganizationOperateFormModel {
  if (!row) {
    return createDefaultFormModel();
  }

  return {
    name: row.name,
    status: row.status
  };
}

async function handleSubmit() {
  await validate();
  emit('submit', {
    name: formModel.name.trim(),
    status: formModel.status
  });
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="420" placement="right">
    <NDrawerContent :title="drawerTitle" closable>
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="small">
        <NFormItem label="组织名称" path="name">
          <NInput v-model:value="formModel.name" clearable placeholder="请输入组织名称" />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NSelect v-model:value="formModel.status" :options="organizationStatusOptions" placeholder="请选择状态" />
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace justify="end" :size="8">
          <NButton size="small" :disabled="loading" @click="drawerVisible = false">取消</NButton>
          <NButton size="small" type="primary" :loading="loading" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
