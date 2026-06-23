<script setup lang="ts">
import BlacklistTable from './BlacklistTable.vue';
import { useBlacklistTable } from './useBlacklistTable';

const {
  canRemove,
  handlePageSizeUpdate,
  handlePageUpdate,
  handleRemoveBlacklistEntry,
  handleRemoveModalVisibleUpdate,
  loading,
  openRemoveModal,
  pagination,
  removeFormModel,
  removeModalVisible,
  removeSubmitting,
  removingRecord,
  records
} = useBlacklistTable();
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="退订黑名单">
    <NSpace vertical :size="12">
      <NAlert type="warning" :bordered="false">
        客户退订后会进入组织级黑名单，发送前和 worker claim 阶段都会拦截。解除黑名单必须填写原因并记录审计日志。
      </NAlert>

      <BlacklistTable
        :records="records"
        :can-remove="canRemove"
        :loading="loading"
        :page="pagination.current"
        :page-size="pagination.size"
        :removing-id="removeSubmitting ? removingRecord?.id : null"
        :total="pagination.total"
        @remove="openRemoveModal"
        @update-page="handlePageUpdate"
        @update-page-size="handlePageSizeUpdate"
      />
    </NSpace>

    <NModal
      :show="removeModalVisible"
      preset="card"
      title="解除黑名单"
      class="blacklist-remove-modal"
      @update:show="handleRemoveModalVisibleUpdate"
    >
      <NSpace vertical :size="12">
        <NAlert type="warning" :bordered="false">解除后不会修改历史回信或时间线，只会影响未来发送拦截。</NAlert>
        <NDescriptions :column="1" bordered size="small" label-placement="left">
          <NDescriptionsItem label="邮箱">{{ removingRecord?.maskedEmail || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="来源邮件">{{ removingRecord?.sourceMessageId || '-' }}</NDescriptionsItem>
        </NDescriptions>
        <NForm :model="removeFormModel" label-placement="top">
          <NFormItem label="解除原因" required>
            <NInput
              v-model:value="removeFormModel.reason"
              type="textarea"
              placeholder="例如：客户邮件确认可以重新联系"
              :autosize="{ minRows: 3, maxRows: 5 }"
            />
          </NFormItem>
        </NForm>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton :disabled="removeSubmitting" @click="handleRemoveModalVisibleUpdate(false)">取消</NButton>
          <NButton type="warning" :loading="removeSubmitting" @click="handleRemoveBlacklistEntry">确认解除</NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>

<style scoped>
.blacklist-remove-modal {
  width: min(520px, calc(100vw - 32px));
}
</style>
