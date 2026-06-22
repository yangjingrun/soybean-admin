<script setup lang="ts">
import CustomerDetailDrawer from './modules/CustomerDetailDrawer.vue';
import CustomerQueueTabs from './modules/CustomerQueueTabs.vue';
import TargetProfileCard from './modules/TargetProfileCard.vue';
import { useAiAssistantPage } from './modules/useAiAssistantPage';

const {
  loading,
  detailVisible,
  detailLoading,
  selectedDetail,
  sendPreference,
  capacitySummary,
  queueViews,
  activeQueueKey,
  loadOverview,
  openDetail,
  handleDetailVisibleUpdate,
  startFollowUp,
  archiveLead,
  restoreLead,
  refreshLeadEnrichment,
  verifyContactEmail,
  goToCrmLeads,
  goToEmailSequences,
  goToInbox
} = useAiAssistantPage();
</script>

<template>
  <div class="ai-assistant-page">
    <TargetProfileCard
      :capacity-summary="capacitySummary"
      :send-preference="sendPreference"
      :loading="loading"
      @refresh="loadOverview"
      @go-crm-leads="goToCrmLeads"
      @go-sequences="goToEmailSequences"
    />

    <CustomerQueueTabs
      :queue-views="queueViews"
      :active-queue-key="activeQueueKey"
      :loading="loading"
      @update:active-queue-key="activeQueueKey = $event"
      @view="openDetail"
      @start-follow-up="startFollowUp"
      @archive="archiveLead"
      @restore="restoreLead"
      @go-inbox="goToInbox"
    />

    <CustomerDetailDrawer
      :show="detailVisible"
      :loading="detailLoading"
      :detail="selectedDetail"
      @update:show="handleDetailVisibleUpdate"
      @start-follow-up="startFollowUp"
      @archive="archiveLead"
      @restore="restoreLead"
      @refresh-enrichment="refreshLeadEnrichment"
      @verify-contact="verifyContactEmail"
      @go-inbox="goToInbox"
      @go-sequences="goToEmailSequences"
    />
  </div>
</template>

<style scoped>
.ai-assistant-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
