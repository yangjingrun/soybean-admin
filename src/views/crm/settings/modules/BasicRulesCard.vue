<script setup lang="ts">
const basicRules = [
  {
    label: '线索隔离',
    value: '成员只能看自己的线索和邮件正文'
  },
  {
    label: '主记录去重',
    value: '同组织内按成员维度复用公司域名和邮箱'
  },
  {
    label: '归档历史',
    value: '归档指纹按组织参与后续获客提醒'
  },
  {
    label: '邮箱验证缓存',
    value: '全平台共享，冷却期内同邮箱跳过重复 DNS/MX 验证'
  }
];
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="14">
      <div class="rule-card-header">
        <div>
          <h3 class="rule-card-title">基础规则</h3>
          <p class="rule-card-desc">CRM 隔离、去重和邮箱验证复用策略</p>
        </div>
        <NTag :bordered="false">只读规则</NTag>
      </div>

      <NDescriptions label-placement="left" bordered :column="1">
        <NDescriptionsItem v-for="item in basicRules" :key="item.label" :label="item.label">
          {{ item.value }}
        </NDescriptionsItem>
      </NDescriptions>

      <NAlert type="info" :bordered="false">
        邮箱验证缓存只保存邮箱 hash、脱敏邮箱、域名和验证结论，不把客户主记录跨组织复用。
      </NAlert>
    </NSpace>
  </NCard>
</template>

<style scoped>
.rule-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rule-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.rule-card-desc {
  margin: 4px 0 0;
  color: var(--n-text-color-3);
  font-size: 13px;
}

@media (max-width: 640px) {
  .rule-card-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
