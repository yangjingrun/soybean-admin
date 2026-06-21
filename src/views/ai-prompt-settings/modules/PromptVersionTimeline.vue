<script setup lang="ts">
import dayjs from 'dayjs';

defineProps<{
  versions: Api.AiGateway.AiPromptVersionRecord[];
  rollingBackVersionId?: string | null;
}>();

const emit = defineEmits<{
  rollback: [version: Api.AiGateway.AiPromptVersionRecord];
}>();

function formatDate(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未记录';
}
</script>

<template>
  <NCard :bordered="false" class="card-wrapper version-panel">
    <NSpace vertical :size="12">
      <NSpace align="center" justify="space-between">
        <NText strong>版本记录</NText>
        <NTag size="small" :bordered="false">{{ versions.length }} 条</NTag>
      </NSpace>

      <NEmpty v-if="versions.length === 0" description="暂无历史版本" />
      <NList v-else hoverable clickable>
        <NListItem v-for="version in versions" :key="version.id">
          <NThing>
            <template #header>
              <NSpace align="center" :size="8">
                <NTag size="small" type="primary" :bordered="false">v{{ version.version }}</NTag>
                <NText strong>{{ version.changeNote || '未填写变更说明' }}</NText>
              </NSpace>
            </template>
            <template #description>
              <NSpace vertical :size="4">
                <NText depth="3">发布人：{{ version.createdByName || '未知' }}</NText>
                <NText depth="3">发布时间：{{ formatDate(version.publishedAt || version.createdAt) }}</NText>
              </NSpace>
            </template>
            <template #action>
              <NButton
                size="small"
                secondary
                :loading="rollingBackVersionId === version.id"
                :disabled="Boolean(rollingBackVersionId)"
                @click.stop="emit('rollback', version)"
              >
                回滚到此版本
              </NButton>
            </template>
          </NThing>
        </NListItem>
      </NList>
    </NSpace>
  </NCard>
</template>

<style scoped>
.version-panel {
  max-height: 420px;
  overflow: hidden;
}
</style>
