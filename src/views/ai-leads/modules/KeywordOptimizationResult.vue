<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';
import type { KeywordOptimizationQueryRow, KeywordOptimizationViewModel } from './shared';

defineProps<{
  viewModel: KeywordOptimizationViewModel;
}>();

const searchQueryColumns: DataTableColumns<KeywordOptimizationQueryRow> = [
  { title: '客户类型', key: 'buyerType', width: 130 },
  { title: '意图', key: 'intent', width: 140 },
  { title: 'Search 查询词', key: 'q', minWidth: 260, ellipsis: { tooltip: true } },
  { title: '地区', key: 'location', width: 130 },
  { title: '优先级', key: 'priority', width: 90 }
];

const placesQueryColumns: DataTableColumns<KeywordOptimizationQueryRow> = [
  { title: '客户类型', key: 'buyerType', width: 150 },
  { title: '意图', key: 'intent', width: 150 },
  { title: 'Places 查询词', key: 'q', minWidth: 240, ellipsis: { tooltip: true } },
  { title: '城市', key: 'city', width: 120 },
  { title: '优先级', key: 'priority', width: 90 }
];
</script>

<template>
  <NSpace vertical :size="14" class="keyword-result">
    <NDescriptions size="small" label-placement="left" bordered :column="1">
      <NDescriptionsItem v-for="item in viewModel.summaryItems" :key="item.label" :label="item.label">
        {{ item.value }}
      </NDescriptionsItem>
    </NDescriptions>

    <section class="keyword-section">
      <div class="section-title">买家类型</div>
      <NGrid :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
        <NGi v-for="segment in viewModel.buyerSegments" :key="segment.buyerType" span="24 m:12 xl:8">
          <div class="buyer-segment">
            <div class="buyer-segment-header">
              <NText strong>{{ segment.buyerType }}</NText>
              <NTag size="small" type="info" :bordered="false">{{ segment.priorityLevel }}</NTag>
            </div>
            <p class="buyer-reason">{{ segment.purchaseReason }}</p>
            <NSpace :size="6">
              <NTag v-for="signal in segment.websiteSignals" :key="signal" size="small" :bordered="false">
                {{ signal }}
              </NTag>
            </NSpace>
            <NText depth="3" class="contact-line">优先联系人：{{ segment.priorityContacts.join('、') }}</NText>
          </div>
        </NGi>
      </NGrid>
    </section>

    <template v-if="viewModel.showQueryDetails">
      <section class="keyword-section">
        <div class="section-title">Search 查询词</div>
        <NDataTable
          size="small"
          :columns="searchQueryColumns"
          :data="viewModel.searchQueries"
          :bordered="false"
          :pagination="{ pageSize: 6 }"
        />
      </section>

      <section class="keyword-section">
        <div class="section-title">Places 查询词</div>
        <NDataTable
          size="small"
          :columns="placesQueryColumns"
          :data="viewModel.placesQueries"
          :bordered="false"
          :pagination="{ pageSize: 6 }"
        />
      </section>
    </template>
  </NSpace>
</template>

<style scoped>
.keyword-result {
  min-width: 0;
}

.keyword-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-weight: 600;
}

.buyer-segment {
  display: flex;
  min-height: 156px;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.buyer-segment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.buyer-reason {
  margin: 0;
  color: var(--n-text-color-2);
  line-height: 1.6;
}

.contact-line {
  margin-top: auto;
}
</style>
