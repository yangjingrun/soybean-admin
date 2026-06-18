<script setup lang="ts">
const basicRules = [
  {
    label: '跟进负责人',
    value: '当前用户'
  },
  {
    label: '线索去重规则',
    value: '公司域名 + 邮箱'
  },
  {
    label: '默认线索阶段',
    value: '待跟进'
  }
];
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="基础规则">
    <NDescriptions label-placement="left" bordered :column="1">
      <NDescriptionsItem v-for="item in basicRules" :key="item.label" :label="item.label">
        {{ item.value }}
      </NDescriptionsItem>
    </NDescriptions>
  </NCard>
</template>
