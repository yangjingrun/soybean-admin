<script setup lang="ts">
import { computed, watch } from 'vue';
import { useAiLeadDirectorySourceRules } from './useAiLeadDirectorySourceRules';

const show = defineModel<boolean>('show', { required: true });

const {
  builtinRecords,
  canSubmit,
  customRecords,
  deletingRuleId,
  form,
  formTitle,
  isFormVisible,
  isLoading,
  isSaving,
  loadRules,
  openCreateForm,
  openEditForm,
  removeRule,
  resetForm,
  submitForm
} = useAiLeadDirectorySourceRules();

const matchModeOptions = [
  { label: '域名后缀', value: 'domain_suffix' },
  { label: 'URL 包含', value: 'url_contains' }
];

const allRecords = computed(() => [...customRecords.value, ...builtinRecords.value]);

watch(
  show,
  value => {
    if (value) {
      void loadRules();
    }
  },
  { immediate: true }
);

function closeForm() {
  isFormVisible.value = false;
  resetForm();
}
</script>

<template>
  <NDrawer v-model:show="show" :width="640" placement="right">
    <NDrawerContent title="黄页过滤字典" closable>
      <NSpace vertical :size="12" class="directory-rules">
        <div class="directory-rules-toolbar">
          <NButton size="small" type="primary" @click="openCreateForm">
            <template #icon>
              <SvgIcon icon="material-symbols:add" />
            </template>
            新增
          </NButton>
          <NButton size="small" secondary :loading="isLoading" @click="loadRules">
            <template #icon>
              <SvgIcon icon="material-symbols:refresh" />
            </template>
            刷新
          </NButton>
        </div>

        <NSpin :show="isLoading">
          <NSpace v-if="allRecords.length" vertical :size="8">
            <div v-for="record in allRecords" :key="record.id" class="directory-rule-item">
              <div class="directory-rule-main">
                <div class="directory-rule-title">
                  <span class="directory-rule-value">{{ record.value }}</span>
                  <NTag size="small" :type="record.enabled ? 'success' : 'warning'" :bordered="false">
                    {{ record.enabled ? '启用' : '停用' }}
                  </NTag>
                  <NTag v-if="record.builtin" size="small" :bordered="false">内置</NTag>
                </div>
                <div class="directory-rule-meta">
                  {{ record.matchMode === 'domain_suffix' ? '域名后缀' : 'URL 包含' }}
                  <template v-if="record.description"> · {{ record.description }}</template>
                </div>
              </div>
              <NSpace v-if="!record.builtin" :size="4" class="directory-rule-actions">
                <NButton quaternary circle size="small" @click="openEditForm(record)">
                  <template #icon>
                    <SvgIcon icon="material-symbols:edit-outline" />
                  </template>
                </NButton>
                <NPopconfirm @positive-click="removeRule(record)">
                  <template #trigger>
                    <NButton
                      quaternary
                      circle
                      size="small"
                      type="error"
                      :loading="deletingRuleId === record.id"
                      :disabled="Boolean(deletingRuleId)"
                    >
                      <template #icon>
                        <SvgIcon icon="material-symbols:delete-outline" />
                      </template>
                    </NButton>
                  </template>
                  删除这条过滤规则？
                </NPopconfirm>
              </NSpace>
            </div>
          </NSpace>
          <NEmpty v-else description="暂无过滤规则" />
        </NSpin>
      </NSpace>
    </NDrawerContent>
  </NDrawer>

  <NModal v-model:show="isFormVisible" preset="card" :title="formTitle" class="directory-rule-modal">
    <NForm :model="form" label-placement="top" size="small">
      <NFormItem label="匹配值" path="value">
        <NInput v-model:value="form.value" placeholder="yellowpages.example.com" />
      </NFormItem>
      <NFormItem label="匹配方式" path="matchMode">
        <NSelect v-model:value="form.matchMode" :options="matchModeOptions" />
      </NFormItem>
      <NFormItem label="状态" path="enabled">
        <NSwitch v-model:value="form.enabled" />
      </NFormItem>
      <NFormItem label="备注" path="description">
        <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton size="small" :disabled="isSaving" @click="closeForm">取消</NButton>
        <NButton size="small" type="primary" :loading="isSaving" :disabled="!canSubmit" @click="submitForm">
          保存
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.directory-rules {
  min-width: 0;
}

.directory-rules-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.directory-rule-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e5eaf3;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px 12px;
}

.directory-rule-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.directory-rule-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.directory-rule-value {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.directory-rule-meta {
  color: #667085;
  font-size: 12px;
}

.directory-rule-actions {
  flex-shrink: 0;
}

.directory-rule-modal {
  width: min(520px, calc(100vw - 32px));
}
</style>
