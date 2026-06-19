<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { fetchCrmProductLineAiPromptVersions, restoreCrmProductLineAiPromptVersion } from '@/service/api';
import {
  buildProductLineAiPromptVersionDiffItems,
  formatProductLineDate,
  summarizeProductLineAiWritingConfig
} from './shared';

const visible = defineModel<boolean>('visible', { required: true });

const props = defineProps<{
  productLineId: string | null;
  productLineName: string;
  currentConfig: Api.Crm.ProductLineAiWritingConfig;
  canRestore?: boolean;
}>();

const emit = defineEmits<{
  restored: [productLine: Api.Crm.ProductLineRecord];
}>();

const message = useMessage();
const versions = shallowRef<Api.Crm.ProductLineAiPromptVersionRecord[]>([]);
const selectedVersionId = shallowRef<string | null>(null);
const loading = shallowRef(false);
const restoringVersionId = shallowRef<string | null>(null);
let latestListRequestId = 0;
let latestRestoreRequestId = 0;

const drawerTitle = computed(() => `${props.productLineName || '产品线'} · AI Prompt 历史`);
const selectedVersion = computed(
  () => versions.value.find(version => version.id === selectedVersionId.value) ?? versions.value[0] ?? null
);
const selectedSummary = computed(() => summarizeProductLineAiWritingConfig(selectedVersion.value?.aiWritingConfig));
const diffItems = computed(() =>
  selectedVersion.value
    ? buildProductLineAiPromptVersionDiffItems(selectedVersion.value.aiWritingConfig, props.currentConfig)
    : []
);

watch(
  () => [visible.value, props.productLineId] as const,
  ([show, productLineId]) => {
    if (show && productLineId) {
      void loadVersions(productLineId);
      return;
    }

    invalidateRequests();
    versions.value = [];
    selectedVersionId.value = null;
  }
);

/** Load version history and keep only the newest drawer request allowed to mutate state. */
async function loadVersions(productLineId = props.productLineId, preferredVersionId?: string) {
  if (!productLineId) {
    return;
  }

  const requestId = latestListRequestId + 1;
  latestListRequestId = requestId;
  loading.value = true;

  try {
    const { data, error } = await fetchCrmProductLineAiPromptVersions(productLineId);

    if (error || requestId !== latestListRequestId || props.productLineId !== productLineId || !visible.value) {
      return;
    }

    versions.value = data.records;
    selectedVersionId.value =
      preferredVersionId && data.records.some(version => version.id === preferredVersionId)
        ? preferredVersionId
        : data.records.some(version => version.id === selectedVersionId.value)
          ? selectedVersionId.value
          : data.records[0]?.id ?? null;
  } finally {
    if (requestId === latestListRequestId) {
      loading.value = false;
    }
  }
}

/** Restore one version and refresh history so the just-created current version is visible. */
async function handleRestore(version: Api.Crm.ProductLineAiPromptVersionRecord) {
  if (!props.canRestore || !props.productLineId || restoringVersionId.value) {
    return;
  }

  const productLineId = props.productLineId;
  const requestId = latestRestoreRequestId + 1;
  latestRestoreRequestId = requestId;
  restoringVersionId.value = version.id;

  try {
    const { data, error } = await restoreCrmProductLineAiPromptVersion(productLineId, version.id);

    if (error || requestId !== latestRestoreRequestId || props.productLineId !== productLineId || !visible.value) {
      return;
    }

    emit('restored', data.productLine);
    message.success(`已恢复到版本 ${version.version}`);
    await loadVersions(productLineId, data.version.id);
  } finally {
    if (requestId === latestRestoreRequestId) {
      restoringVersionId.value = null;
    }
  }
}

function invalidateRequests() {
  latestListRequestId += 1;
  latestRestoreRequestId += 1;
  restoringVersionId.value = null;
}

function getVersionAiConfigMeta(config: Api.Crm.ProductLineAiWritingConfig | null) {
  const summary = summarizeProductLineAiWritingConfig(config);
  const filledStepCount = summary.steps.filter(step => step.prompt).length;

  return `${summary.enabledLabel} · Step Prompt ${filledStepCount}/5`;
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="720" placement="right">
    <NDrawerContent :title="drawerTitle" closable>
      <NSpace vertical :size="14">
        <NAlert v-if="!canRestore" type="info" :bordered="false">
          普通成员可查看 AI Prompt 历史，恢复历史版本需组织管理员或超级管理员操作。
        </NAlert>

        <NSpin :show="loading">
          <NEmpty v-if="!loading && versions.length === 0" description="暂无 AI Prompt 历史版本" />

          <div v-else class="prompt-version-layout">
            <section class="prompt-version-list">
              <NSpace align="center" justify="space-between" class="prompt-version-section-title">
                <NText strong>版本列表</NText>
                <NText depth="3">{{ versions.length }} 条</NText>
              </NSpace>

              <NScrollbar class="prompt-version-scroll">
                <NList hoverable clickable>
                  <NListItem
                    v-for="version in versions"
                    :key="version.id"
                    class="prompt-version-item"
                    :class="{ 'prompt-version-item--active': version.id === selectedVersion?.id }"
                    @click="selectedVersionId = version.id"
                  >
                    <NThing>
                      <template #header>
                        <NSpace align="center" :size="8">
                          <NTag size="small" type="primary" :bordered="false">v{{ version.version }}</NTag>
                          <NText strong>{{ version.changeSummary || '未填写变更说明' }}</NText>
                        </NSpace>
                      </template>
                      <template #description>
                        <NSpace vertical :size="4">
                          <NText depth="3">创建人：{{ version.editorName || '未知' }}</NText>
                          <NText depth="3">创建时间：{{ formatProductLineDate(version.createdAt) }}</NText>
                          <NText depth="3">AI 配置：{{ getVersionAiConfigMeta(version.aiWritingConfig) }}</NText>
                        </NSpace>
                      </template>
                    </NThing>
                  </NListItem>
                </NList>
              </NScrollbar>
            </section>

            <section v-if="selectedVersion" class="prompt-version-detail">
              <NSpace align="center" justify="space-between" class="prompt-version-section-title">
                <NSpace vertical :size="2">
                  <NText strong>版本 v{{ selectedVersion.version }} 摘要</NText>
                  <NText depth="3">{{ formatProductLineDate(selectedVersion.createdAt) }}</NText>
                </NSpace>

                <NPopconfirm
                  :disabled="!canRestore || Boolean(restoringVersionId)"
                  @positive-click="handleRestore(selectedVersion)"
                >
                  <template #trigger>
                    <NButton
                      size="small"
                      type="primary"
                      :disabled="!canRestore || Boolean(restoringVersionId)"
                      :loading="restoringVersionId === selectedVersion.id"
                    >
                      恢复此版本
                    </NButton>
                  </template>
                  确认恢复到 v{{ selectedVersion.version }}？当前 AI Prompt 会被后端替换并生成新版本。
                </NPopconfirm>
              </NSpace>

              <NSpace vertical :size="12">
                <NDescriptions :column="1" bordered size="small" label-placement="left">
                  <NDescriptionsItem label="启用状态">{{ selectedSummary.enabledLabel }}</NDescriptionsItem>
                  <NDescriptionsItem label="通用要求">
                    {{ selectedSummary.commonRequirements || '未填写' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="禁止内容">
                    {{ selectedSummary.forbiddenClaims || '未填写' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="产品重点">
                    {{ selectedSummary.productEmphasis || '未填写' }}
                  </NDescriptionsItem>
                </NDescriptions>

                <NDivider class="prompt-version-divider">当前 step prompt 概览</NDivider>
                <NList bordered>
                  <NListItem v-for="step in selectedSummary.steps" :key="step.stepIndex">
                    <NThing :title="`第 ${step.stepIndex} 封`" :description="step.preview || '未填写'" />
                  </NListItem>
                </NList>

                <NDivider class="prompt-version-divider">与当前表单差异</NDivider>
                <NEmpty v-if="diffItems.length === 0" description="与当前表单配置一致" />
                <NSpace v-else vertical :size="10">
                  <div v-for="item in diffItems" :key="item.key" class="prompt-version-diff-item">
                    <NText strong>{{ item.label }}</NText>
                    <div class="prompt-version-diff-grid">
                      <div class="prompt-version-diff-block">
                        <NText depth="3">历史版本</NText>
                        <NText class="prompt-version-preserve">{{ item.versionValue || '未填写' }}</NText>
                      </div>
                      <div class="prompt-version-diff-block">
                        <NText depth="3">当前表单</NText>
                        <NText class="prompt-version-preserve">{{ item.currentValue || '未填写' }}</NText>
                      </div>
                    </div>
                  </div>
                </NSpace>
              </NSpace>
            </section>
          </div>
        </NSpin>
      </NSpace>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.prompt-version-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 14px;
}

.prompt-version-list,
.prompt-version-detail {
  min-width: 0;
}

.prompt-version-section-title {
  margin-bottom: 8px;
}

.prompt-version-scroll {
  max-height: calc(100vh - 176px);
}

.prompt-version-item {
  cursor: pointer;
}

.prompt-version-item--active {
  background-color: var(--n-merged-color-hover);
}

.prompt-version-divider {
  margin: 4px 0;
}

.prompt-version-diff-item {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 10px;
}

.prompt-version-diff-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.prompt-version-diff-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.prompt-version-preserve {
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 720px) {
  .prompt-version-layout,
  .prompt-version-diff-grid {
    grid-template-columns: 1fr;
  }

  .prompt-version-scroll {
    max-height: 260px;
  }
}
</style>
