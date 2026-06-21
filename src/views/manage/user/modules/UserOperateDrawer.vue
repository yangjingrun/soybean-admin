<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { FormRules } from 'naive-ui';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { getDefaultUserPermissionsByRoles, userPermissionGroups, userRoleOptions, userStatusOptions } from './shared';

type OperateType = 'add' | 'edit';

interface UserOperateFormModel {
  userName: string;
  nickName: string;
  phone: string;
  email: string;
  roles: Api.SystemUser.UserRole[];
  permissions: Api.SystemUser.PermissionCode[];
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
const permissionTouched = ref(false);

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

    Object.assign(
      formModel,
      props.operateType === 'add' ? createDefaultFormModel() : createFormModelFromRow(props.row)
    );
    permissionTouched.value = false;
    void nextTick(restoreValidation);
  }
);

watch(
  () => [...formModel.roles],
  roles => {
    if (props.operateType !== 'add' || permissionTouched.value) {
      return;
    }

    formModel.permissions = getDefaultUserPermissionsByRoles(roles);
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
    permissions: getDefaultUserPermissionsByRoles(['R_USER']),
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
    permissions: [...row.permissions],
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
    permissions: [...formModel.permissions],
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

function handlePermissionUpdate(value: Array<string | number>) {
  permissionTouched.value = true;
  formModel.permissions = value.filter((item): item is Api.SystemUser.PermissionCode => typeof item === 'string');
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
                :options="userRoleOptions"
                multiple
                clearable
                placeholder="请选择角色"
              />
            </NFormItem>
          </NGi>
          <NGi span="24">
            <NFormItem label="权限" path="permissions">
              <NCheckboxGroup :value="formModel.permissions" @update:value="handlePermissionUpdate">
                <NSpace vertical :size="10" class="permission-groups">
                  <div v-for="group in userPermissionGroups" :key="group.key" class="permission-group">
                    <div class="permission-group__title">{{ group.label }}</div>
                    <NSpace :size="[16, 8]" wrap>
                      <NCheckbox v-for="option in group.options" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </NCheckbox>
                    </NSpace>
                  </div>
                </NSpace>
              </NCheckboxGroup>
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

.permission-groups {
  width: 100%;
}

.permission-group {
  border-bottom: 1px solid var(--n-border-color);
  padding-bottom: 10px;
}

.permission-group:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.permission-group__title {
  margin-bottom: 8px;
  color: var(--n-text-color-2);
  font-size: 13px;
  line-height: 20px;
}
</style>
