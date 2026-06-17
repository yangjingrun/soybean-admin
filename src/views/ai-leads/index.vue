<script setup lang="ts">
const workflowItems = [
  {
    title: '线索来源',
    description: '后续可接入关键词、行业、地区等获客条件。'
  },
  {
    title: 'AI筛选',
    description: '预留客户画像、匹配度、联系建议等判断结果。'
  },
  {
    title: '跟进转化',
    description: '后续可沉淀线索状态、备注、任务和转化记录。'
  }
];
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="ai-leads-header">
        <div>
          <p class="ai-leads-eyebrow text-primary">AI Leads</p>
          <h2 class="ai-leads-title">AI获客</h2>
          <p class="ai-leads-desc">先搭好获客工作台入口，后续再补充搜索、筛选、线索列表和跟进动作。</p>
        </div>
        <NButton type="primary" disabled>开始获客</NButton>
      </div>
    </NCard>

    <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <NGi v-for="item in workflowItems" :key="item.title" span="24 s:24 m:8">
        <NCard :bordered="false" class="card-wrapper">
          <NSpace vertical :size="8">
            <NText strong>{{ item.title }}</NText>
            <NText depth="3">{{ item.description }}</NText>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped>
.ai-leads-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ai-leads-eyebrow {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.ai-leads-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.ai-leads-desc {
  margin: 10px 0 0;
  color: var(--n-text-color-3);
}

@media (max-width: 640px) {
  .ai-leads-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
