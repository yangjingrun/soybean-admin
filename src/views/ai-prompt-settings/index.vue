<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { aiSettingsPromptManagePermission, hasPermission } from '@soybean/shared';
import { useAuthStore } from '@/store/modules/auth';
import PromptEditor from './modules/PromptEditor.vue';
import PromptPublishPanel from './modules/PromptPublishPanel.vue';
import PromptStepList from './modules/PromptStepList.vue';
import PromptVersionTimeline from './modules/PromptVersionTimeline.vue';
import { usePromptSettingsPage } from './modules/usePromptSettingsPage';

const authStore = useAuthStore();
const canManagePrompt = computed(
  () => authStore.isStaticSuper || hasPermission(authStore.userInfo, aiSettingsPromptManagePermission)
);
const canEditGlobalPrompt = computed(() => authStore.isStaticSuper || authStore.userInfo.roles.includes('R_SUPER'));

const page = usePromptSettingsPage();
const versionDrawerVisible = shallowRef(false);

watch(
  canManagePrompt,
  canManage => {
    if (canManage && page.steps.value.length === 0) {
      void page.loadSteps();
    }
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="canManagePrompt" class="prompt-workbench">
    <div class="prompt-workbench__nav">
      <PromptStepList
        :steps="page.steps.value"
        :selected-prompt-key="page.selectedPromptKey.value"
        :loading="page.loadingSteps.value"
        @reload="page.loadSteps()"
        @select="page.selectPrompt"
      />
    </div>

    <PromptEditor
      v-model:system-prompt="page.systemPrompt.value"
      :detail="page.detail.value"
      :can-edit="canEditGlobalPrompt"
      :focus-section-request="page.focusSectionRequest.value"
      :loading="page.loadingDetail.value"
      :version-count="page.versions.value.length"
      @use-default="page.useDefaultPrompt"
      @open-versions="versionDrawerVisible = true"
    />

    <div class="prompt-workbench__side">
      <PromptPublishPanel
        v-model:change-note="page.changeNote.value"
        :can-edit="canEditGlobalPrompt"
        :is-dirty="page.isDirty.value"
        :can-publish="canEditGlobalPrompt && page.canPublish.value"
        :publish-readiness-hint="page.publishReadinessHint.value"
        :publishing="page.publishing.value"
        @publish="page.publishCurrentPrompt"
      />
    </div>

    <NDrawer v-model:show="versionDrawerVisible" :width="520" placement="right">
      <NDrawerContent title="版本记录" closable>
        <PromptVersionTimeline
          :versions="page.versions.value"
          :can-rollback="canEditGlobalPrompt"
          :rolling-back-version-id="page.rollingBackVersionId.value"
          @rollback="page.rollbackVersion"
        />
      </NDrawerContent>
    </NDrawer>
  </div>

  <NCard v-else :bordered="false" class="card-wrapper">
    <NEmpty description="暂无权限查看提示词配置" />
  </NCard>
</template>

<style scoped>
.prompt-workbench {
  --prompt-workbench-border: #e7ecf5;
  --prompt-workbench-muted: #f6f8fc;
  --prompt-workbench-ink: #1f2937;
  --prompt-workbench-subtle: #667085;
  --prompt-workbench-primary: rgb(var(--primary-color));

  display: grid;
  grid-template-columns: minmax(236px, 268px) minmax(560px, 1fr) minmax(316px, 348px);
  align-items: stretch;
  gap: 14px;
  height: calc(100vh - 168px);
  min-height: 0;
  overflow: hidden;
}

.prompt-workbench > * {
  min-height: 0;
}

.prompt-workbench__nav,
.prompt-workbench__side {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.prompt-workbench__side {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
}

@media (max-width: 1280px) {
  .prompt-workbench {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    height: auto;
    overflow: visible;
  }

  .prompt-workbench__nav,
  .prompt-workbench__side {
    height: auto;
    overflow: visible;
  }

  .prompt-workbench__side {
    grid-column: 2;
  }
}

@media (max-width: 860px) {
  .prompt-workbench {
    grid-template-columns: 1fr;
  }

  .prompt-workbench__side {
    grid-template-columns: 1fr;
  }

  .prompt-workbench__side {
    grid-column: auto;
  }
}
</style>
