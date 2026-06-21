<script setup lang="ts">
import { computed } from 'vue';
import { summarizePromptValidation } from './shared';

const props = defineProps<{
  validationResult: Api.AiGateway.AiPromptValidationResult | null;
  latestTestRun: Api.AiGateway.AiPromptTestRunRecord | null;
  isDirty?: boolean;
  canSaveDraft?: boolean;
  canValidate?: boolean;
  canTest?: boolean;
  canPublish?: boolean;
  savingDraft?: boolean;
  validating?: boolean;
  testing?: boolean;
  publishing?: boolean;
}>();

const emit = defineEmits<{
  validate: [];
  saveDraft: [];
  test: [];
  publish: [];
}>();

const testInput = defineModel<string>('testInput', { required: true });
const changeNote = defineModel<string>('changeNote', { required: true });
const validationSummary = computed(() => summarizePromptValidation(props.validationResult));
const latestOutput = computed(() => props.latestTestRun?.outputText || '');
</script>

<template>
  <NCard :bordered="false" class="card-wrapper publish-panel">
    <NSpace vertical :size="14">
      <div class="publish-panel__header">
        <div>
          <NText strong>测试与发布检查</NText>
          <p class="publish-panel__desc">{{ validationSummary.label }}</p>
        </div>
        <NTag :type="validationSummary.ok ? 'success' : 'warning'" :bordered="false">
          {{ validationSummary.ok ? '可发布' : '待检查' }}
        </NTag>
      </div>

      <NAlert v-if="isDirty" type="warning" :bordered="false">当前内容有未保存修改，发布前需要先保存草稿。</NAlert>

      <section class="publish-panel__section">
        <div class="publish-panel__section-title">
          <NText strong>规则校验</NText>
          <NButton size="tiny" :loading="validating" :disabled="!canValidate" @click="emit('validate')">重新校验</NButton>
        </div>
        <NEmpty v-if="!validationResult" description="尚未校验" />
        <NList v-else size="small">
          <NListItem v-for="item in validationResult.items" :key="item.key">
            <NThing>
              <template #header>
                <NSpace align="center" :size="8">
                  <NTag
                    size="small"
                    :type="item.status === 'pass' ? 'success' : item.status === 'warn' ? 'warning' : 'error'"
                    :bordered="false"
                  >
                    {{ item.status }}
                  </NTag>
                  <NText>{{ item.label }}</NText>
                </NSpace>
              </template>
              <template #description>{{ item.message }}</template>
            </NThing>
          </NListItem>
        </NList>
      </section>

      <section class="publish-panel__section">
        <NInput
          v-model:value="testInput"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          placeholder="填写一条测试获客需求"
        />
        <NButton block secondary :loading="testing" :disabled="!canTest" @click="emit('test')">运行测试</NButton>
        <div v-if="latestTestRun" class="publish-panel__test-result">
          <NSpace align="center" justify="space-between">
            <NText strong>最近测试</NText>
            <NTag size="small" :type="latestTestRun.success ? 'success' : 'error'" :bordered="false">
              {{ latestTestRun.success ? '通过' : '失败' }}
            </NTag>
          </NSpace>
          <NText v-if="latestTestRun.errorMessage" type="error">{{ latestTestRun.errorMessage }}</NText>
          <pre v-if="latestOutput" class="publish-panel__output">{{ latestOutput }}</pre>
        </div>
      </section>

      <section class="publish-panel__section">
        <NInput v-model:value="changeNote" placeholder="变更说明，例如：收紧 Maps q 规则" />
        <NSpace :size="8" justify="end">
          <NButton :loading="savingDraft" :disabled="!canSaveDraft" @click="emit('saveDraft')">保存草稿</NButton>
          <NButton type="primary" :loading="publishing" :disabled="!canPublish" @click="emit('publish')">
            发布全局版本
          </NButton>
        </NSpace>
      </section>
    </NSpace>
  </NCard>
</template>

<style scoped>
.publish-panel {
  position: sticky;
  top: 12px;
}

.publish-panel__header,
.publish-panel__section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.publish-panel__desc {
  margin: 4px 0 0;
  color: var(--n-text-color-3);
  font-size: 13px;
}

.publish-panel__section {
  display: grid;
  gap: 10px;
}

.publish-panel__test-result {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.publish-panel__output {
  overflow: auto;
  max-height: 180px;
  margin: 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--n-code-color);
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
