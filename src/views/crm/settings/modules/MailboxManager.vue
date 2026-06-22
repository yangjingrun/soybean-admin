<script setup lang="ts">
import { computed, shallowRef } from 'vue';
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
import { buildCrmSettingsOverview, buildCrmSettingsTabVisibility, type CrmSettingsOverviewKey } from './shared';
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
const activeSettingsKey = shallowRef<CrmSettingsOverviewKey>('mailboxConnection');

const canManageOrganization = computed(() => hasPermission(authStore.userInfo, 'crm:settings:rules:write'));
const canManageAiDraftQueue = computed(() => hasPermission(authStore.userInfo, 'crm:settings:ai-draft-queue:write'));
const canManageGlobalConfig = computed(() => hasPermission(authStore.userInfo, 'crm:settings:global:write'));
const tabVisibility = computed(() => buildCrmSettingsTabVisibility(authStore.userInfo));
const sectionVisibility = computed<Record<CrmSettingsOverviewKey, boolean>>(() => ({
  mailboxConnection: tabVisibility.value.start,
  safetyBlock: tabVisibility.value.safety,
  sendPace: tabVisibility.value.start || tabVisibility.value.rules,
  syncHealth: tabVisibility.value.operations,
  writingProfile: tabVisibility.value.start || tabVisibility.value.assets
}));
const overviewItems = computed(() =>
  buildCrmSettingsOverview({
    mailboxes: records.value,
    mailboxTotal: pagination.total,
    templateDefaults: templateDefaults.value
  }).filter(item => sectionVisibility.value[item.key])
);

/** Selects the settings section controlled by the overview cards. */
function handleSelectSettingsSection(key: CrmSettingsOverviewKey) {
  activeSettingsKey.value = key;
}
</script>

<template>
  <NSpace vertical :size="12">
    <CrmSettingsOverview
      :active-key="activeSettingsKey"
      :items="overviewItems"
      :loading="loading || templateDefaultsLoading"
      @select="handleSelectSettingsSection"
    />

    <section v-show="activeSettingsKey === 'mailboxConnection'" class="settings-section">
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
    </section>

    <section v-show="activeSettingsKey === 'writingProfile'" class="settings-section">
      <NSpace vertical :size="12">
        <DefaultEmailTemplateCard
          :loading="templateDefaultsLoading"
          :template-defaults="templateDefaults"
          @refresh="loadTemplateDefaults"
        />
        <ProductLineManager v-if="tabVisibility.assets" />
        <PersonaProfileManager v-if="tabVisibility.assets" />
        <EmailTemplateManager v-if="tabVisibility.assets" />
      </NSpace>
    </section>

    <section v-show="activeSettingsKey === 'sendPace'" class="settings-section">
      <NSpace vertical :size="12">
        <SendPreferenceCard />
        <SequencePolicyManager v-if="tabVisibility.rules" />
        <OrganizationPermissionCard v-if="canManageOrganization" />
        <AiDraftQueueConfigCard v-if="canManageAiDraftQueue" />
        <GlobalConfigCard v-if="canManageGlobalConfig" />
      </NSpace>
    </section>

    <section v-if="sectionVisibility.safetyBlock" v-show="activeSettingsKey === 'safetyBlock'" class="settings-section">
      <NSpace vertical :size="12">
        <BasicRulesCard />
        <BlacklistManager />
      </NSpace>
    </section>

    <section v-if="sectionVisibility.syncHealth" v-show="activeSettingsKey === 'syncHealth'" class="settings-section">
      <NSpace vertical :size="12">
        <CrmOperationsPanel />
        <StrategyStatsPanel />
      </NSpace>
    </section>

    <AuthorizeMailboxModal
      v-model:visible="authorizeVisible"
      :submitting="authorizeSubmitting"
      @submit="handleAuthorizeMailbox"
      @update:visible="handleAuthorizeVisibleUpdate"
    />
  </NSpace>
</template>

<style scoped>
.settings-section {
  min-width: 0;
}
</style>
