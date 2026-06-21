<script setup lang="ts">
import { computed } from 'vue';
import { hasPermission } from '@soybean/shared';
import { useAuthStore } from '@/store/modules/auth';
import AiDraftQueueConfigCard from './AiDraftQueueConfigCard.vue';
import AuthorizeMailboxModal from './AuthorizeMailboxModal.vue';
import BasicRulesCard from './BasicRulesCard.vue';
import BlacklistManager from './BlacklistManager.vue';
import CrmOperationsPanel from './CrmOperationsPanel.vue';
import CrmSettingsOverview from './CrmSettingsOverview.vue';
import DefaultEmailTemplateCard from './DefaultEmailTemplateCard.vue';
import EmailTemplateManager from './EmailTemplateManager.vue';
import GlobalConfigCard from './GlobalConfigCard.vue';
import MailboxTable from './MailboxTable.vue';
import MailboxToolbar from './MailboxToolbar.vue';
import OrganizationPermissionCard from './OrganizationPermissionCard.vue';
import PersonaProfileManager from './PersonaProfileManager.vue';
import ProductLineManager from './ProductLineManager.vue';
import SendPreferenceCard from './SendPreferenceCard.vue';
import SequencePolicyManager from './SequencePolicyManager.vue';
import StrategyStatsPanel from './StrategyStatsPanel.vue';
import { buildCrmSettingsOverview, buildCrmSettingsTabVisibility } from './shared';
import { useMailboxTable } from './useMailboxTable';
import { useTemplateDefaults } from './useTemplateDefaults';

const authStore = useAuthStore();
const {
  authorizeSubmitting,
  authorizeVisible,
  filterModel,
  handleAuthorizeMailbox,
  handleAuthorizeVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReauthorizeMailbox,
  handleRenewMailboxWatch,
  handleReset,
  handleSearch,
  handleSyncMailboxNow,
  handleToggleMailbox,
  loadMailboxes,
  loading,
  openAuthorizeModal,
  operatingMailboxId,
  pagination,
  records
} = useMailboxTable();

const { loadTemplateDefaults, loading: templateDefaultsLoading, templateDefaults } = useTemplateDefaults();

const canManageOrganization = computed(() => hasPermission(authStore.userInfo, 'crm:settings:rules:write'));
const canManageAiDraftQueue = computed(() =>
  hasPermission(authStore.userInfo, 'crm:settings:ai-draft-queue:write')
);
const canManageGlobalConfig = computed(() => hasPermission(authStore.userInfo, 'crm:settings:global:write'));
const tabVisibility = computed(() => buildCrmSettingsTabVisibility(authStore.userInfo));
const overviewItems = computed(() =>
  buildCrmSettingsOverview({
    mailboxes: records.value,
    mailboxTotal: pagination.total,
    templateDefaults: templateDefaults.value
  })
);
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="CRM 配置中心" subtitle="先接通邮箱，再配置写信资料、发送规则和安全边界" />

    <CrmSettingsOverview :items="overviewItems" :loading="loading || templateDefaultsLoading" />

    <NTabs type="segment" animated>
      <NTabPane name="start" tab="开始使用">
        <NSpace vertical :size="12">
          <SendPreferenceCard />

          <DefaultEmailTemplateCard
            :loading="templateDefaultsLoading"
            :template-defaults="templateDefaults"
            @refresh="loadTemplateDefaults"
          />

          <NCard :bordered="false" size="small" class="card-wrapper" title="邮箱账号">
            <NSpace vertical :size="12">
              <MailboxToolbar
                v-model="filterModel"
                :authorizing="authorizeSubmitting"
                :loading="loading"
                @add="openAuthorizeModal"
                @refresh="loadMailboxes"
                @reset="handleReset"
                @search="handleSearch"
              />

              <MailboxTable
                :records="records"
                :loading="loading"
                :operating-mailbox-id="operatingMailboxId"
                :page="pagination.current"
                :page-size="pagination.size"
                :total="pagination.total"
                @reauthorize="handleReauthorizeMailbox"
                @renew-watch="handleRenewMailboxWatch"
                @sync-now="handleSyncMailboxNow"
                @toggle="handleToggleMailbox"
                @update-page="handlePageUpdate"
                @update-page-size="handlePageSizeUpdate"
              />
            </NSpace>
          </NCard>
        </NSpace>
      </NTabPane>

      <NTabPane v-if="tabVisibility.assets" name="assets" tab="写信资料">
        <NSpace vertical :size="12">
          <ProductLineManager />
          <PersonaProfileManager />
          <EmailTemplateManager />
        </NSpace>
      </NTabPane>

      <NTabPane v-if="tabVisibility.rules" name="rules" tab="发送规则">
        <NSpace vertical :size="12">
          <SequencePolicyManager />
          <OrganizationPermissionCard v-if="canManageOrganization" />
          <AiDraftQueueConfigCard v-if="canManageAiDraftQueue" />
          <GlobalConfigCard v-if="canManageGlobalConfig" />
        </NSpace>
      </NTabPane>

      <NTabPane v-if="tabVisibility.safety" name="safety" tab="安全与拦截">
        <NSpace vertical :size="12">
          <BasicRulesCard />
          <BlacklistManager />
        </NSpace>
      </NTabPane>

      <NTabPane v-if="tabVisibility.operations" name="operations" tab="运维诊断">
        <NSpace vertical :size="12">
          <CrmOperationsPanel />
          <StrategyStatsPanel />
        </NSpace>
      </NTabPane>
    </NTabs>

    <AuthorizeMailboxModal
      v-model:visible="authorizeVisible"
      :submitting="authorizeSubmitting"
      @submit="handleAuthorizeMailbox"
      @update:visible="handleAuthorizeVisibleUpdate"
    />
  </NSpace>
</template>
