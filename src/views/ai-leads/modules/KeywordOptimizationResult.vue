<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';
import type { KeywordOptimizationQueryRow, KeywordOptimizationViewModel } from './shared';

defineProps<{
  viewModel: KeywordOptimizationViewModel;
  editable?: boolean;
}>();

const keywordPlan = defineModel<Api.AiLeads.OptimizedKeywordPlan | null>('keywordPlan', { required: true });

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

/** Adds one editable buyer segment to the current keyword plan. */
function addBuyerSegment() {
  keywordPlan.value?.buyerSegments.push({
    buyerType: '',
    purchaseReason: '',
    websiteSignals: [],
    priorityContacts: [],
    priorityLevel: '中'
  });
}

/** Removes one buyer segment from the editable keyword plan. */
function removeBuyerSegment(index: number) {
  keywordPlan.value?.buyerSegments.splice(index, 1);
}

function formatList(items: string[]) {
  return items.join('\n');
}

function updateSegmentList(
  segment: Api.AiLeads.BuyerSegment,
  key: 'websiteSignals' | 'priorityContacts',
  value: string
) {
  segment[key] = value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

</script>

<template>
  <NSpace vertical :size="14" class="keyword-result">
    <NForm v-if="editable && keywordPlan" :model="keywordPlan" label-placement="top" size="small" class="keyword-editor">
      <NGrid :x-gap="12" :y-gap="10" responsive="screen" item-responsive class="summary-editor-grid">
        <NGi span="24 m:12">
          <NFormItem label="需求归纳">
            <NInput
              v-model:value="keywordPlan.structuredRequirement"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NGi>
        <NGi span="24 m:12">
          <NFormItem label="产品关键词">
            <NInput
              v-model:value="keywordPlan.resolvedProductKeywords"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NGi>
        <NGi span="24 m:12">
          <NFormItem label="目标市场">
            <NInput v-model:value="keywordPlan.resolvedTargetRegions" />
          </NFormItem>
        </NGi>
        <NGi span="24 m:12">
          <NFormItem label="客户画像">
            <NInput
              v-model:value="keywordPlan.resolvedTargetCustomerProfile"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NGi>
      </NGrid>

      <section class="keyword-section">
        <div class="section-heading">
          <div class="section-title">买家类型</div>
          <NButton size="tiny" secondary @click="addBuyerSegment">新增</NButton>
        </div>
        <NSpace vertical :size="10">
          <div v-for="(segment, index) in keywordPlan.buyerSegments" :key="index" class="buyer-segment editor">
            <div class="buyer-segment-header">
              <NInput v-model:value="segment.buyerType" placeholder="客户类型" />
              <NButton size="tiny" quaternary type="error" @click="removeBuyerSegment(index)">删除</NButton>
            </div>
            <NInput
              v-model:value="segment.purchaseReason"
              type="textarea"
              placeholder="采购原因"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
            <NGrid :x-gap="10" :y-gap="8" responsive="screen" item-responsive>
              <NGi span="24 m:12">
                <NInput
                  :value="formatList(segment.websiteSignals)"
                  type="textarea"
                  placeholder="官网信号，每行一条"
                  :autosize="{ minRows: 2, maxRows: 5 }"
                  @update:value="updateSegmentList(segment, 'websiteSignals', $event)"
                />
              </NGi>
              <NGi span="24 m:12">
                <NInput
                  :value="formatList(segment.priorityContacts)"
                  type="textarea"
                  placeholder="优先联系人，每行一条"
                  :autosize="{ minRows: 2, maxRows: 5 }"
                  @update:value="updateSegmentList(segment, 'priorityContacts', $event)"
                />
              </NGi>
            </NGrid>
            <NInput v-model:value="segment.priorityLevel" placeholder="优先级" />
          </div>
        </NSpace>
      </section>
    </NForm>

    <NDescriptions v-else size="small" label-placement="left" bordered :column="1" class="summary-descriptions">
      <NDescriptionsItem v-for="item in viewModel.summaryItems" :key="item.label" :label="item.label">
        {{ item.value }}
      </NDescriptionsItem>
    </NDescriptions>

    <section v-if="!editable" class="keyword-section">
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
      <section class="keyword-section query-section">
        <div class="section-title">Search 查询词</div>
        <NDataTable
          size="small"
          :columns="searchQueryColumns"
          :data="viewModel.searchQueries"
          :bordered="false"
          :pagination="{ pageSize: 6 }"
        />
      </section>

      <section class="keyword-section query-section">
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
  --keyword-primary: #5b75ff;
  --keyword-primary-deep: #7c5cff;
  --keyword-soft: #f3f6ff;
  --keyword-border: #dbe5ff;
}

.keyword-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e6ecf7;
  border-radius: 8px;
  background: #fbfcff;
}

.keyword-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-editor-grid,
.summary-descriptions {
  padding: 12px;
  border: 1px solid #e6ecf7;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, var(--keyword-soft) 100%);
}

.summary-editor-grid :deep(.n-form-item-label) {
  font-weight: 600;
}

.summary-descriptions :deep(.n-descriptions-table) {
  background: #ffffff;
}

.section-title {
  display: inline-flex;
  align-items: center;
  color: #24324b;
  font-weight: 600;
}

.section-title::before {
  width: 3px;
  height: 14px;
  margin-right: 8px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--keyword-primary), var(--keyword-primary-deep));
  content: '';
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.buyer-segment {
  position: relative;
  display: flex;
  min-height: 156px;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
  border: 1px solid var(--keyword-border);
  border-left: 4px solid var(--keyword-primary);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgb(91 117 255 / 10%) 0%, rgb(124 92 255 / 5%) 34%, #ffffff 72%),
    #ffffff;
  box-shadow: 0 6px 18px rgb(15 23 42 / 4%);
}

.buyer-segment::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--keyword-primary), var(--keyword-primary-deep));
  content: '';
}

.buyer-segment.editor {
  min-height: auto;
  background:
    linear-gradient(90deg, rgb(91 117 255 / 12%) 0%, rgb(124 92 255 / 5%) 30%, #ffffff 68%),
    #ffffff;
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

.query-section :deep(.n-data-table) {
  overflow: hidden;
  border: 1px solid #e6ecf7;
  border-radius: 8px;
}

.query-section :deep(.n-data-table-th) {
  background: #f4f7ff;
}
</style>
