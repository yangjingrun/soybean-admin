<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';
import type { KeywordOptimizationQueryRow, KeywordOptimizationViewModel } from './shared';

defineProps<{
  viewModel: KeywordOptimizationViewModel;
  editable?: boolean;
  showQueryDetails?: boolean;
}>();

const keywordPlan = defineModel<Api.AiLeads.OptimizedKeywordPlan | null>('keywordPlan', { required: true });

const searchQueryColumns: DataTableColumns<KeywordOptimizationQueryRow> = [
  { title: '客户类型', key: 'buyerType', width: 160 },
  { title: '意图', key: 'intent', width: 160 },
  { title: 'Search 查询词', key: 'q', minWidth: 260, ellipsis: { tooltip: true } },
  { title: '地区', key: 'location', width: 130 },
  { title: '优先级', key: 'priority', width: 90 }
];

const placesQueryColumns: DataTableColumns<KeywordOptimizationQueryRow> = [
  { title: '客户类型', key: 'buyerType', width: 160 },
  { title: '意图', key: 'intent', width: 160 },
  { title: 'Places 查询词', key: 'q', minWidth: 240, ellipsis: { tooltip: true } },
  { title: '城市', key: 'city', width: 130 },
  { title: '优先级', key: 'priority', width: 90 }
];

const mapsQueryColumns: DataTableColumns<KeywordOptimizationQueryRow> = [
  { title: '客户类型', key: 'buyerType', width: 160 },
  { title: '意图', key: 'intent', width: 160 },
  { title: 'Maps 查询词', key: 'q', minWidth: 240, ellipsis: { tooltip: true } },
  { title: '城市/区域', key: 'city', width: 130 },
  { title: '地图中心', key: 'll', width: 190, ellipsis: { tooltip: true } },
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
    <NForm
      v-if="editable && keywordPlan"
      :model="keywordPlan"
      label-placement="top"
      size="small"
      class="keyword-editor"
    >
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

    <template v-if="showQueryDetails && viewModel.showQueryDetails">
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

      <section class="keyword-section query-section">
        <div class="section-title">Maps 查询词</div>
        <NDataTable
          size="small"
          :columns="mapsQueryColumns"
          :data="viewModel.mapsQueries"
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
  --keyword-primary: rgb(var(--primary-color));
  --keyword-soft: rgb(var(--primary-50-color));
  --keyword-border: #e5eaf3;
  --keyword-muted: #f7f9fc;
}

.keyword-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e6ecf7;
  border-radius: 8px;
  background: var(--keyword-muted);
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
  background: #ffffff;
}

.summary-editor-grid :deep(.n-form-item-label) {
  font-weight: 600;
}

.summary-descriptions :deep(.n-descriptions-table) {
  background: #ffffff;
}

.section-title {
  color: #24324b;
  font-weight: 600;
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
  border-radius: 8px;
  background: #ffffff;
}

.buyer-segment.editor {
  min-height: auto;
  background: #ffffff;
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
  background: var(--keyword-muted);
}
</style>
