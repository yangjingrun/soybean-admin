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
      :focus-section-request="page.focusSectionRequest.value"
      :loading="page.loadingDetail.value"
      :version-count="page.versions.value.length"
      @use-default="page.useDefaultPrompt"
      @open-versions="versionDrawerVisible = true"
    />

    <div class="prompt-workbench__side">
      <PromptPublishPanel
        v-model:test-input="page.testInput.value"
        v-model:change-note="page.changeNote.value"
        :validation-result="page.validationResult.value"
        :latest-test-run="page.latestTestRun.value"
        :is-dirty="page.isDirty.value"
        :can-save-draft="page.canSaveDraft.value"
        :can-validate="page.canValidate.value"
        :can-test="page.canTest.value"
        :can-publish="page.canPublish.value"
        :saving-draft="page.savingDraft.value"
        :validating="page.validating.value"
        :testing="page.testing.value"
        :publishing="page.publishing.value"
        @validate="page.validateCurrentPrompt"
        @save-draft="page.saveCurrentDraft"
        @test="page.testCurrentDraft"
        @focus-section="page.focusPromptSection"
        @publish="page.publishCurrentDraft"
      />
    </div>

    <NDrawer v-model:show="versionDrawerVisible" :width="520" placement="right">
      <NDrawerContent title="版本记录" closable>
        <PromptVersionTimeline
          :versions="page.versions.value"
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
  align-items: start;
  gap: 14px;
  min-height: calc(100vh - 168px);
}

.prompt-workbench__nav,
.prompt-workbench__side {
  position: sticky;
  top: 12px;
}

.prompt-workbench__side {
  display: grid;
  gap: 12px;
}

@media (max-width: 1280px) {
  .prompt-workbench {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  }

  .prompt-workbench__nav,
  .prompt-workbench__side {
    position: static;
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
