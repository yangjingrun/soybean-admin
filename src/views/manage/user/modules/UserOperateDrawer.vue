<script setup lang="ts">
import { computed, nextTick, reactive, shallowRef, watch } from 'vue';
import type { FormRules } from 'naive-ui';
import { fetchEnabledSystemRoles } from '@/service/api/system-role';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { userRoleOptions, userStatusOptions } from './shared';

type OperateType = 'add' | 'edit';

interface UserOperateFormModel {
  userName: string;
  nickName: string;
  phone: string;
  email: string;
  roles: Api.SystemUser.UserRole[];
  status: Api.SystemUser.UserStatus;
  companyName: string;
  expireAt: number | null;
  remark: string;
}

const drawerVisible = defineModel<boolean>('show', { required: true });

const props = defineProps<{
  operateType: OperateType;
  row: Api.SystemUser.UserListItem | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: Api.SystemUser.UserCreatePayload | Api.SystemUser.UserUpdatePayload];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule, patternRules } = useFormRules();

const formModel = reactive<UserOperateFormModel>(createDefaultFormModel());
const roleOptions = shallowRef<Array<{ label: string; value: Api.SystemUser.UserRole }>>(userRoleOptions);

const drawerTitle = computed(() => (props.operateType === 'add' ? '新增用户' : '编辑用户'));

const rules: FormRules = {
  userName: [createRequiredRule('请输入用户名'), patternRules.userName],
  roles: [
    {
      type: 'array',
      required: true,
      min: 1,
      message: '请至少选择一个角色',
      trigger: 'change'
    }
  ],
  status: [createRequiredRule('请选择状态')],
  phone: patternRules.phone,
  email: patternRules.email
};

watch(
  () => drawerVisible.value,
  visible => {
    if (!visible) {
      return;
    }

    void loadRoleOptions();
    Object.assign(formModel, props.operateType === 'add' ? createDefaultFormModel() : createFormModelFromRow(props.row));
    void nextTick(restoreValidation);
  }
);

/** Create an empty form model for adding users. */
function createDefaultFormModel(): UserOperateFormModel {
  return {
    userName: '',
    nickName: '',
    phone: '',
    email: '',
    roles: ['R_USER'],
    status: 'enabled',
    companyName: '',
    expireAt: null,
    remark: ''
  };
}

/** Convert a table row into the editable drawer form model. */
function createFormModelFromRow(row: Api.SystemUser.UserListItem | null): UserOperateFormModel {
  if (!row) {
    return createDefaultFormModel();
  }

  return {
    userName: row.userName,
    nickName: row.nickName || '',
    phone: row.phone || '',
    email: row.email || '',
    roles: [...row.roles],
    status: row.status,
    companyName: row.companyName || '',
    expireAt: row.expireAt ? new Date(row.expireAt).getTime() : null,
    remark: row.remark || ''
  };
}

/** Normalize optional text fields before sending them to the backend. */
function normalizeOptionalText(value: string) {
  const text = value.trim();

  return text || null;
}

/** Convert the drawer form model to the backend create/update payload. */
function createPayload(): Api.SystemUser.UserCreatePayload {
  return {
    userName: formModel.userName.trim(),
    nickName: normalizeOptionalText(formModel.nickName),
    phone: normalizeOptionalText(formModel.phone),
    email: normalizeOptionalText(formModel.email),
    roles: [...formModel.roles],
    status: formModel.status,
    companyName: normalizeOptionalText(formModel.companyName),
    expireAt: formModel.expireAt ? new Date(formModel.expireAt).toISOString() : null,
    remark: normalizeOptionalText(formModel.remark)
  };
}

async function handleSubmit() {
  await validate();
  emit('submit', createPayload());
}

/** Load enabled roles for assigning roles to a user. */
async function loadRoleOptions() {
  const { data, error } = await fetchEnabledSystemRoles();

  if (error) {
    return;
  }

  roleOptions.value = data.map(role => ({
    label: role.roleName,
    value: role.roleCode
  }));
}
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :width="520" placement="right">
    <NDrawerContent :title="drawerTitle" closable>
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="small">
        <NGrid :cols="24" :x-gap="12">
          <NGi span="24 m:12">
            <NFormItem label="用户名" path="userName">
              <NInput v-model:value="formModel.userName" clearable placeholder="请输入登录账号" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12">
            <NFormItem label="昵称" path="nickName">
              <NInput v-model:value="formModel.nickName" clearable placeholder="请输入昵称" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12">
            <NFormItem label="手机" path="phone">
              <NInput v-model:value="formModel.phone" clearable placeholder="请输入手机号" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12">
            <NFormItem label="邮箱" path="email">
              <NInput v-model:value="formModel.email" clearable placeholder="请输入邮箱" />
            </NFormItem>
          </NGi>
          <NGi span="24">
            <NFormItem label="角色" path="roles">
              <NSelect
                v-model:value="formModel.roles"
                :options="roleOptions"
                multiple
                clearable
                placeholder="请选择角色"
              />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12">
            <NFormItem label="状态" path="status">
              <NSelect v-model:value="formModel.status" :options="userStatusOptions" placeholder="请选择状态" />
            </NFormItem>
          </NGi>
          <NGi span="24 m:12">
            <NFormItem label="有效期" path="expireAt">
              <NDatePicker v-model:value="formModel.expireAt" type="datetime" clearable class="full-input" />
            </NFormItem>
          </NGi>
          <NGi span="24">
            <NFormItem label="公司" path="companyName">
              <NInput v-model:value="formModel.companyName" clearable placeholder="请输入公司名称" />
            </NFormItem>
          </NGi>
          <NGi span="24">
            <NFormItem label="备注" path="remark">
              <NInput
                v-model:value="formModel.remark"
                type="textarea"
                clearable
                placeholder="请输入备注"
                :autosize="{ minRows: 3, maxRows: 5 }"
              />
            </NFormItem>
          </NGi>
        </NGrid>
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

<style scoped>
.full-input {
  width: 100%;
}

</style>
