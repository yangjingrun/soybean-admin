<script setup lang="ts">
const ownerOptions = [
  {
    label: '跟进负责人',
    value: '待接入成员数据'
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
  <NSpace vertical :size="16">
    <NPageHeader title="CRM配置" subtitle="配置线索分配、邮件身份和基础 CRM 规则">
      <template #extra>
        <NTag type="info" :bordered="false">占位版</NTag>
      </template>
    </NPageHeader>

    <NAlert type="default" :bordered="false">
      当前页面只保留配置骨架，保存动作会在后端 CRM 配置接口完成后接入。
    </NAlert>

    <NGrid responsive="screen" :x-gap="12" :y-gap="12" cols="1 m:2">
      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper" title="基础规则">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem v-for="item in ownerOptions" :key="item.label" :label="item.label">
              {{ item.value }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>

      <NGi>
        <NCard :bordered="false" size="small" class="card-wrapper" title="邮件身份">
          <NForm label-placement="left" :label-width="96" disabled>
            <NFormItem label="发件邮箱">
              <NInput value="待配置" />
            </NFormItem>
            <NFormItem label="发件人名称">
              <NInput value="待配置" />
            </NFormItem>
            <NFormItem label="自动归档">
              <NSwitch :value="false" />
            </NFormItem>
          </NForm>
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>
