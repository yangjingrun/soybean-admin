<script setup lang="ts">
import { computed, watch } from 'vue';
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
    <PromptStepList
      :steps="page.steps.value"
      :selected-prompt-key="page.selectedPromptKey.value"
      :loading="page.loadingSteps.value"
      @reload="page.loadSteps()"
      @select="page.selectPrompt"
    />

    <PromptEditor
      v-model:system-prompt="page.systemPrompt.value"
      :detail="page.detail.value"
      :focus-section-request="page.focusSectionRequest.value"
      :loading="page.loadingDetail.value"
      @use-default="page.useDefaultPrompt"
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

      <PromptVersionTimeline
        :versions="page.versions.value"
        :rolling-back-version-id="page.rollingBackVersionId.value"
        @rollback="page.rollbackVersion"
      />
    </div>
  </div>

  <NCard v-else :bordered="false" class="card-wrapper">
    <NEmpty description="暂无权限查看提示词配置" />
  </NCard>
</template>

<style scoped>
.prompt-workbench {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(300px, 360px);
  align-items: flex-start;
  gap: 16px;
}

.prompt-workbench__side {
  display: grid;
  gap: 16px;
}

@media (max-width: 1280px) {
  .prompt-workbench {
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  }

  .prompt-workbench__side {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .prompt-workbench,
  .prompt-workbench__side {
    grid-template-columns: 1fr;
  }
}
</style>
