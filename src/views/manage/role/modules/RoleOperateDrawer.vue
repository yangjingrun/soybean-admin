<script setup lang="ts">
import { computed, nextTick, reactive, watch } from 'vue';
import type { FormRules } from 'naive-ui';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { roleStatusOptions } from './shared';

type OperateType = 'add' | 'edit';

interface RoleOperateFormModel {
  roleName: string;
  roleCode: string;
  roleDesc: string;
  status: Api.SystemRole.RoleStatus;
}

const drawerVisible = defineModel<boolean>('show', { required: true });

const props = defineProps<{
  loading?: boolean;
  operateType: OperateType;
  row: Api.SystemRole.RoleListItem | null;
}>();

const emit = defineEmits<{
  submit: [payload: Api.SystemRole.RoleCreatePayload | Api.SystemRole.RoleUpdatePayload];
}>();

const { formRef, restoreValidation, validate } = useNaiveForm();
const { createRequiredRule } = useFormRules();
const formModel = reactive<RoleOperateFormModel>(createDefaultFormModel());

const drawerTitle = computed(() => (props.operateType === 'add' ? '新增角色' : '编辑角色'));
const isEdit = computed(() => props.operateType === 'edit');

const rules: FormRules = {
  roleName: [createRequiredRule('请输入角色名称')],
  roleCode: [createRequiredRule('请输入角色编码')],
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

/** Create an empty role form model. */
function createDefaultFormModel(): RoleOperateFormModel {
  return {
    roleName: '',
    roleCode: '',
    roleDesc: '',
    status: 'enabled'
  };
}

/** Convert table row data into the drawer form model. */
function createFormModelFromRow(row: Api.SystemRole.RoleListItem | null): RoleOperateFormModel {
  if (!row) {
    return createDefaultFormModel();
  }

  return {
    roleName: row.roleName,
    roleCode: row.roleCode,
    roleDesc: row.roleDesc || '',
    status: row.status
  };
}

function normalizeOptionalText(value: string) {
  const text = value.trim();

  return text || null;
}

async function handleSubmit() {
  await validate();

  if (props.operateType === 'add') {
    emit('submit', {
      roleName: formModel.roleName.trim(),
      roleCode: formModel.roleCode.trim().toUpperCase(),
      roleDesc: normalizeOptionalText(formModel.roleDesc),
      status: formModel.status,
      permissions: []
    });
    return;
  }

  emit('submit', {
    roleName: formModel.roleName.trim(),
    roleDesc: normalizeOptionalText(formModel.roleDesc),
    status: formModel.status
  });
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="420" placement="right">
    <NDrawerContent :title="drawerTitle" closable>
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="small">
        <NFormItem label="角色名称" path="roleName">
          <NInput v-model:value="formModel.roleName" clearable placeholder="请输入角色名称" />
        </NFormItem>
        <NFormItem label="角色编码" path="roleCode">
          <NInput
            v-model:value="formModel.roleCode"
            :disabled="isEdit"
            clearable
            placeholder="例如 R_SALES_MANAGER"
          />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NSelect v-model:value="formModel.status" :options="roleStatusOptions" placeholder="请选择状态" />
        </NFormItem>
        <NFormItem label="描述" path="roleDesc">
          <NInput
            v-model:value="formModel.roleDesc"
            type="textarea"
            clearable
            placeholder="请输入角色说明"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
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
