<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { completeCrmGmailOAuthCallback } from '@/service/api';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const status = shallowRef<'loading' | 'error'>('loading');
const errorMessage = shallowRef('Gmail 授权失败');

const resultStatus = computed(() => (status.value === 'loading' ? 'info' : 'error'));
const resultTitle = computed(() => (status.value === 'loading' ? '正在完成 Gmail 授权' : 'Gmail 授权失败'));
const resultDescription = computed(() =>
  status.value === 'loading' ? '请稍候，系统正在写入授权邮箱。' : errorMessage.value
);

onMounted(() => {
  void completeAuthorization();
});

/** Submit Google's callback query to the backend while the user session is still active. */
async function completeAuthorization() {
  const code = getQueryString('code');
  const state = getQueryString('state');

  if (!code || !state) {
    status.value = 'error';
    errorMessage.value = 'Google 回调缺少 code 或 state';
    return;
  }

  const { error } = await completeCrmGmailOAuthCallback({ code, state });

  if (error) {
    status.value = 'error';
    return;
  }

  message.success('Gmail 授权完成');
  await router.replace('/crm/settings');
}

function getQueryString(key: string) {
  const value = route.query[key];

  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return typeof value === 'string' ? value : '';
}
</script>

<template>
  <NCard :bordered="false" class="callback-card">
    <NResult :status="resultStatus" :title="resultTitle" :description="resultDescription">
      <template #footer>
        <NButton v-if="status === 'error'" type="primary" @click="router.replace('/crm/settings')">
          返回 CRM 配置
        </NButton>
      </template>
    </NResult>
  </NCard>
</template>

<style scoped>
.callback-card {
  max-width: 640px;
  margin: 72px auto 0;
}
</style>
