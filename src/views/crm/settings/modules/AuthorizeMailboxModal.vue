<script setup lang="ts">
const visible = defineModel<boolean>('visible', { required: true });

defineProps<{
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();
</script>

<template>
  <NModal v-model:show="visible" preset="card" title="授权 Gmail" class="authorize-mailbox-modal">
    <NSpace vertical :size="12">
      <NAlert type="info" :show-icon="true">
        将打开 Google 授权页面，授权完成后会自动回到 CRM 配置。
      </NAlert>
      <NText depth="3">第一版仅支持普通 Gmail 地址，不支持 alias / send-as 独立邮箱。</NText>
    </NSpace>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="submitting" @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="emit('submit')">去授权</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.authorize-mailbox-modal {
  width: min(480px, calc(100vw - 32px));
}
</style>
