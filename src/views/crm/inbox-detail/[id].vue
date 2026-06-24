<script setup lang="ts">
import InboxThreadDetailPanel from '../inbox/modules/InboxThreadDetailPanel.vue';
import { useInboxThreadDetail } from '../inbox/modules/shared/useInboxThreadDetail';

const {
  canRestorePolishSnapshot,
  currentDetail,
  detailLoading,
  draftPolishing,
  draftSaving,
  handleBack,
  handleConfirmUnsubscribe,
  handlePolishReplyDraft,
  handleRestorePolishSnapshot,
  handleSaveReplyDraft,
  handleSendReply,
  loadThreadDetail,
  replyBody,
  replySending,
  replyTopic,
  unsubscribeConfirming
} = useInboxThreadDetail();
</script>

<template>
  <div class="inbox-detail-page">
    <InboxThreadDetailPanel
      v-model:reply-body="replyBody"
      v-model:reply-topic="replyTopic"
      :can-restore-polish="canRestorePolishSnapshot"
      :detail="currentDetail"
      :draft-polishing="draftPolishing"
      :draft-saving="draftSaving"
      :loading="detailLoading"
      :reply-sending="replySending"
      :unsubscribe-confirming="unsubscribeConfirming"
      @back="handleBack"
      @confirm-unsubscribe="handleConfirmUnsubscribe"
      @reload="loadThreadDetail()"
      @polish-reply-draft="handlePolishReplyDraft"
      @restore-polish="handleRestorePolishSnapshot"
      @save-reply-draft="handleSaveReplyDraft"
      @send-reply="handleSendReply"
    />
  </div>
</template>

<style scoped>
.inbox-detail-page {
  box-sizing: border-box;
  height: calc(100vh - var(--soy-header-height) - var(--soy-tab-height) - var(--soy-footer-height));
  min-height: 0;
  overflow: hidden;
}
</style>
