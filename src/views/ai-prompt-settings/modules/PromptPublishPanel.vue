<script setup lang="ts">
defineProps<{
  canEdit?: boolean;
  isDirty?: boolean;
  canPublish?: boolean;
  publishReadinessHint?: string;
  publishing?: boolean;
}>();

const emit = defineEmits<{
  publish: [];
}>();

const changeNote = defineModel<string>('changeNote', { required: true });
</script>

<template>
  <NCard :bordered="false" class="card-wrapper publish-panel" content-class="publish-panel__card-content">
    <NScrollbar class="publish-panel__scroll">
      <div class="publish-panel__content">
        <div class="publish-panel__top">
          <div>
            <div class="publish-panel__eyebrow">发布入口</div>
            <NText strong>全局版本发布</NText>
            <p class="publish-panel__desc">发布后业务会立即使用当前提示词版本。</p>
          </div>
          <NTag :type="canPublish ? 'success' : 'warning'" :bordered="false">
            {{ canPublish ? '可发布' : '待检查' }}
          </NTag>
        </div>

        <NAlert type="info" :bordered="false">
          CRM 开发信按数据库已发布版本生效；缺少发布版本时，需要超级管理员先发布提示词。
        </NAlert>

        <NAlert v-if="!canEdit" type="warning" :bordered="false">
          当前账号仅可查看提示词配置，发布和回滚请使用超级管理员账号。
        </NAlert>

        <NAlert v-if="isDirty" type="warning" :bordered="false">
          当前内容与正在生效的版本不同，点击发布后会直接覆盖为新的全局版本。
        </NAlert>

        <section class="publish-panel__section">
          <div class="publish-panel__section-title">
            <NText strong>变更说明</NText>
            <NText depth="3" class="publish-panel__section-note">选填</NText>
          </div>
          <NInput v-model:value="changeNote" :disabled="!canEdit" placeholder="例如：收紧 CRM 事实边界" />
        </section>

        <section class="publish-panel__section">
          <NButton
            type="primary"
            block
            :loading="publishing"
            :disabled="!canEdit || !canPublish || publishing"
            @click="emit('publish')"
          >
            发布全局版本
          </NButton>
          <NText depth="3" class="publish-panel__publish-hint" :type="canPublish ? 'success' : 'warning'">
            {{ publishReadinessHint }}
          </NText>
        </section>
      </div>
    </NScrollbar>
  </NCard>
</template>

<style scoped>
.publish-panel {
  height: 100%;
  overflow: hidden;
}

.publish-panel :deep(.publish-panel__card-content) {
  display: flex;
  box-sizing: border-box;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.publish-panel__scroll {
  height: 100%;
  max-height: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.publish-panel__scroll :deep(.n-scrollbar-container) {
  height: 100%;
  max-height: 100%;
}

.publish-panel__content {
  display: grid;
  gap: 14px;
}

.publish-panel__top,
.publish-panel__section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.publish-panel__eyebrow {
  margin-bottom: 4px;
  color: var(--prompt-workbench-primary);
  font-size: 12px;
  font-weight: 700;
}

.publish-panel__desc {
  margin: 4px 0 0;
  color: var(--prompt-workbench-subtle);
  font-size: 13px;
  line-height: 1.5;
}

.publish-panel__section {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--prompt-workbench-border);
}

.publish-panel__section-note {
  font-size: 12px;
}

.publish-panel__publish-hint {
  display: block;
  line-height: 1.5;
}

@media (max-width: 1280px) {
  .publish-panel {
    height: auto;
    overflow: visible;
  }

  .publish-panel :deep(.publish-panel__card-content) {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .publish-panel__scroll,
  .publish-panel__scroll :deep(.n-scrollbar-container) {
    height: auto;
    max-height: none;
  }
}
</style>
