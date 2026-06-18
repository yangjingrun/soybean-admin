<script setup lang="ts">
import { createTextVNode, defineComponent, h } from 'vue';
import { NButton, useDialog, useLoadingBar, useMessage, useNotification } from 'naive-ui';
import { router } from '@/router';
import { setRequestBusinessErrorHandler } from '@/service/request/business-error';

defineOptions({
  name: 'AppProvider'
});

const ContextHolder = defineComponent({
  name: 'ContextHolder',
  setup() {
    function register() {
      window.$loadingBar = useLoadingBar();
      window.$dialog = useDialog();
      window.$message = useMessage();
      window.$notification = useNotification();

      setRequestBusinessErrorHandler(error => {
        if (error.type !== 'missing-model-config') {
          return false;
        }

        const notification = window.$notification?.warning({
          title: '模型配置未完成',
          content: error.message,
          meta: '当前功能需要先配置默认模型。',
          duration: 6000,
          keepAliveOnHover: true,
          action: () =>
            h(
              NButton,
              {
                size: 'small',
                type: 'primary',
                onClick: () => {
                  notification?.destroy();
                  void router.push({ name: 'ai-settings' });
                }
              },
              { default: () => '去模型配置' }
            )
        });

        return true;
      });
    }

    register();

    return () => createTextVNode();
  }
});
</script>

<template>
  <NLoadingBarProvider>
    <NDialogProvider>
      <NNotificationProvider>
        <NMessageProvider>
          <ContextHolder />
          <slot></slot>
        </NMessageProvider>
      </NNotificationProvider>
    </NDialogProvider>
  </NLoadingBarProvider>
</template>

<style scoped></style>
