<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useRouterPush } from '@/hooks/common/router';
import { useSvgIcon } from '@/hooks/common/icon';
import { $t } from '@/locales';
import ChangePasswordModal from './change-password/ChangePasswordModal.vue';
import UserProfileModal from './user-profile/UserProfileModal.vue';

defineOptions({
  name: 'UserAvatar'
});

const authStore = useAuthStore();
const { routerPushByKey, toLogin } = useRouterPush();
const { SvgIconVNode } = useSvgIcon();
const userProfileVisible = shallowRef(false);
const changePasswordVisible = shallowRef(false);

function loginOrRegister() {
  toLogin();
}

type DropdownKey = 'profile' | 'changePassword' | 'logout';

type DropdownOption =
  | {
      key: DropdownKey;
      label: string;
      icon?: () => VNode;
    }
  | {
      type: 'divider';
      key: string;
    };

const options = computed(() => {
  const opts: DropdownOption[] = [
    {
      label: '个人信息',
      key: 'profile',
      icon: SvgIconVNode({ icon: 'ph:user-gear', fontSize: 18 })
    },
    {
      label: '修改密码',
      key: 'changePassword',
      icon: SvgIconVNode({ icon: 'ph:password', fontSize: 18 })
    },
    {
      type: 'divider',
      key: 'account-divider'
    },
    {
      label: $t('common.logout'),
      key: 'logout',
      icon: SvgIconVNode({ icon: 'ph:sign-out', fontSize: 18 })
    }
  ];

  return opts;
});

function logout() {
  window.$dialog?.info({
    title: $t('common.tip'),
    content: $t('common.logoutConfirm'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await authStore.logout();
    }
  });
}

function handleDropdown(key: DropdownKey) {
  if (key === 'profile') {
    userProfileVisible.value = true;
  } else if (key === 'changePassword') {
    changePasswordVisible.value = true;
  } else if (key === 'logout') {
    logout();
  } else {
    // If your other options are jumps from other routes, they will be directly supported here
    routerPushByKey(key);
  }
}
</script>

<template>
  <NButton v-if="!authStore.isLogin" quaternary @click="loginOrRegister">
    {{ $t('page.login.common.loginOrRegister') }}
  </NButton>
  <NDropdown v-else placement="bottom" trigger="click" :options="options" @select="handleDropdown">
    <div>
      <ButtonIcon>
        <SvgIcon icon="ph:user-circle" class="text-icon-large" />
        <span class="text-16px font-medium">{{ authStore.userDisplayName }}</span>
      </ButtonIcon>
    </div>
  </NDropdown>
  <UserProfileModal v-model:show="userProfileVisible" />
  <ChangePasswordModal v-model:show="changePasswordVisible" />
</template>

<style scoped></style>
