<script setup lang="ts">
import AuthorizeMailboxModal from './AuthorizeMailboxModal.vue';
import BasicRulesCard from './BasicRulesCard.vue';
import BlacklistManager from './BlacklistManager.vue';
import CrmOperationsPanel from './CrmOperationsPanel.vue';
import DefaultEmailTemplateCard from './DefaultEmailTemplateCard.vue';
import EmailTemplateManager from './EmailTemplateManager.vue';
import GlobalConfigCard from './GlobalConfigCard.vue';
import MailboxTable from './MailboxTable.vue';
import MailboxToolbar from './MailboxToolbar.vue';
import OrganizationPermissionCard from './OrganizationPermissionCard.vue';
import PersonaProfileManager from './PersonaProfileManager.vue';
import ProductLineManager from './ProductLineManager.vue';
import SequencePolicyManager from './SequencePolicyManager.vue';
import { useMailboxTable } from './useMailboxTable';
import { useTemplateDefaults } from './useTemplateDefaults';

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
</script>

<template>
  <NSpace vertical :size="16">
    <NPageHeader title="CRM配置" subtitle="线索分配、邮箱账号和基础规则" />

    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1">
      <NGi>
        <BasicRulesCard />
      </NGi>

      <NGi>
        <GlobalConfigCard />
      </NGi>

      <NGi>
        <OrganizationPermissionCard />
      </NGi>

      <NGi>
        <EmailTemplateManager />
      </NGi>

      <NGi>
        <DefaultEmailTemplateCard
          :loading="templateDefaultsLoading"
          :template-defaults="templateDefaults"
          @refresh="loadTemplateDefaults"
        />
      </NGi>

      <NGi>
        <SequencePolicyManager />
      </NGi>

      <NGi>
        <PersonaProfileManager />
      </NGi>

      <NGi>
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
      </NGi>

      <NGi>
        <CrmOperationsPanel />
      </NGi>

      <NGi>
        <ProductLineManager />
      </NGi>

      <NGi>
        <BlacklistManager />
      </NGi>
    </NGrid>

    <AuthorizeMailboxModal
      v-model:visible="authorizeVisible"
      :submitting="authorizeSubmitting"
      @submit="handleAuthorizeMailbox"
      @update:visible="handleAuthorizeVisibleUpdate"
    />
  </NSpace>
</template>
