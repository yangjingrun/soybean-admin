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
  handleAuthorizeMailbox,
  handleAuthorizeVisibleUpdate,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleReauthorizeMailbox,
  handleRenewMailboxWatch,
  handleSyncMailboxNow,
  handleToggleMailbox,
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
        <template #header-extra>
          <NButton size="small" type="primary" :loading="authorizeSubmitting" @click="openAuthorizeModal">
            新增授权
          </NButton>
        </template>

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
      </NCard>
    </section>

    <section v-show="activeSettingsKey === 'writingProfile'" class="settings-section">
      <NSpace vertical :size="12">
        <NText depth="3">下面这些资料，系统会用来自动帮你写开发信。</NText>

        <DefaultEmailTemplateCard
          :loading="templateDefaultsLoading"
          :template-defaults="templateDefaults"
          @refresh="loadTemplateDefaults"
        />

        <template v-if="tabVisibility.assets">
          <div class="writing-block">
            <NText depth="3" class="writing-block__intro">我卖什么 · 系统写信时用这里的卖点介绍你的产品</NText>
            <ProductLineManager />
          </div>

          <div class="writing-block">
            <NText depth="3" class="writing-block__intro">写给谁 · 不同岗位关心的点不同，系统按角色调整话术</NText>
            <PersonaProfileManager />
          </div>

          <NCollapse>
            <NCollapseItem name="templates" title="开发信模板库（进阶 · 默认模板已够用，需要多套话术再展开）">
              <EmailTemplateManager />
            </NCollapseItem>
          </NCollapse>
        </template>
      </NSpace>
    </section>

    <section v-show="activeSettingsKey === 'sendPace'" class="settings-section">
      <NSpace vertical :size="12">
        <NText depth="3">
          跟进按默认{{
            templateDefaults ? ` ${templateDefaults.templateGroup.steps.length} 步序列` : '多步序列'
          }}推进（封数在「写信资料」里调整）；这里设置每天发多少、新老客户怎么分。
        </NText>

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

.writing-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.writing-block__intro {
  font-size: 13px;
}
</style>
