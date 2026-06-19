<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import dayjs from 'dayjs';
import { useMessage } from 'naive-ui';
import { fetchCrmOrganizationConfig, saveCrmOrganizationConfig } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';

const message = useMessage();
const authStore = useAuthStore();

const allowAdminViewMemberEmailBody = shallowRef(false);
const loading = shallowRef(false);
const saving = shallowRef(false);
const updatedAt = shallowRef<string | null>(null);

const canManage = computed(
  () => authStore.userInfo.organizationRole === 'admin' || authStore.userInfo.roles.includes('R_SUPER')
);
const formattedUpdatedAt = computed(() => {
  if (!updatedAt.value || dayjs(updatedAt.value).valueOf() <= 0) {
    return '尚未保存';
  }

  return dayjs(updatedAt.value).format('YYYY-MM-DD HH:mm:ss');
});

onMounted(() => {
  void loadOrganizationConfig(false);
});

/** Load organization-level CRM permission settings. */
async function loadOrganizationConfig(showMessage = true) {
  if (loading.value) {
    return;
  }

  loading.value = true;

  try {
    const { data, error } = await fetchCrmOrganizationConfig();

    if (error) {
      return;
    }

    allowAdminViewMemberEmailBody.value = data.allowAdminViewMemberEmailBody;
    updatedAt.value = data.updatedAt;

    if (showMessage) {
      message.success('CRM 权限配置已加载');
    }
  } finally {
    loading.value = false;
  }
}

/** Save organization-level CRM permission settings. */
async function saveOrganizationConfig() {
  if (!canManage.value || saving.value) {
    return;
  }

  saving.value = true;

  try {
    const { data, error } = await saveCrmOrganizationConfig({
      allowAdminViewMemberEmailBody: allowAdminViewMemberEmailBody.value
    });

    if (error) {
      return;
    }

    allowAdminViewMemberEmailBody.value = data.allowAdminViewMemberEmailBody;
    updatedAt.value = data.updatedAt;
    message.success('CRM 权限配置已保存');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="组织权限">
    <NSpace vertical :size="12">
      <NAlert type="warning" :bordered="false">
        负责人本人始终可查看自己的邮件正文；开启后，组织管理员也可以查看成员邮件正文。
      </NAlert>

      <NAlert v-if="!canManage" type="info" :bordered="false">
        当前账号仅可查看组织权限配置，修改需组织管理员操作。
      </NAlert>

      <NForm label-placement="left" label-width="220" size="small">
        <NFormItem label="管理员查看成员邮件正文">
          <NSwitch v-model:value="allowAdminViewMemberEmailBody" :disabled="!canManage || loading || saving" />
        </NFormItem>
      </NForm>

      <div class="permission-card-footer">
        <NText depth="3" class="updated-time">配置时间：{{ formattedUpdatedAt }}</NText>
        <NSpace :size="8">
          <NButton size="small" :loading="loading" @click="loadOrganizationConfig()">重新加载</NButton>
          <NButton size="small" type="primary" :loading="saving" :disabled="!canManage" @click="saveOrganizationConfig">
            保存
          </NButton>
        </NSpace>
      </div>
    </NSpace>
  </NCard>
</template>

<style scoped>
.permission-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.updated-time {
  font-size: 12px;
}

@media (max-width: 640px) {
  .permission-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
