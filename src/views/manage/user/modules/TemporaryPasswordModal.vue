<script setup lang="ts">
const modalVisible = defineModel<boolean>('show', { required: true });

defineProps<{
  userName: string;
  password: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();

async function handleCopy(password: string) {
  await navigator.clipboard.writeText(password);
  window.$message?.success('临时密码已复制');
}

function handleAfterLeave() {
  emit('clear');
}
</script>

<template>
  <NModal
    v-model:show="modalVisible"
    preset="card"
    title="临时密码"
    :bordered="false"
    class="temporary-password-modal"
    @after-leave="handleAfterLeave"
  >
    <NSpace vertical :size="12">
      <NAlert type="warning" :bordered="false">临时密码仅展示一次，请立即保存并交给用户。</NAlert>

      <NDescriptions :column="1" size="small" bordered>
        <NDescriptionsItem label="用户">{{ userName }}</NDescriptionsItem>
        <NDescriptionsItem label="临时密码">
          <div class="password-row">
            <NText code>{{ password }}</NText>
            <NButton size="tiny" type="primary" ghost @click="handleCopy(password)">复制</NButton>
          </div>
        </NDescriptionsItem>
      </NDescriptions>
    </NSpace>

    <template #footer>
      <NSpace justify="end">
        <NButton size="small" type="primary" @click="modalVisible = false">我已保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.temporary-password-modal {
  width: min(460px, calc(100vw - 32px));
}

.password-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
