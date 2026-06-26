<script setup lang="ts">
import type { SelectOption } from 'naive-ui';
import CrmRegionCascader from '@/components/common/crm-region-cascader.vue';
import type { CrmRegionCascaderOption } from '@/utils/crm-region-cascader';
import type { AiLeadContextOption, ProductLineSummaryItem } from './shared';

const productLineId = defineModel<string | null>('productLineId', { required: true });
const targetRegionValues = defineModel<string[]>('targetRegionValues', { required: true });
const targetCustomerTypeKeys = defineModel<string[]>('targetCustomerTypeKeys', { required: true });
const exclusionRuleKeys = defineModel<string[]>('exclusionRuleKeys', { required: true });
const keywordText = defineModel<string>('keywordText', { required: true });
const requirement = defineModel<string>('requirement', { required: true });

defineProps<{
  disabled?: boolean;
  loading?: boolean;
  options: SelectOption[];
  productLine: Api.Crm.ProductLineRecord | null;
  summaryItems: ProductLineSummaryItem[];
  customerTypeOptions: AiLeadContextOption[];
  exclusionRuleOptions: AiLeadContextOption[];
}>();

const emit = defineEmits<{
  'update:targetRegionPath': [path: CrmRegionCascaderOption[]];
  'update:targetRegionPaths': [paths: CrmRegionCascaderOption[][]];
}>();
</script>

<template>
  <div class="product-line-context">
    <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
      <NGi span="24 m:12">
        <NFormItem label="产品线" required>
          <NSelect
            v-model:value="productLineId"
            filterable
            :loading="loading"
            :disabled="disabled"
            :options="options"
            placeholder="选择本次开发对应的产品线"
          />
        </NFormItem>
      </NGi>

      <NGi span="24 m:12">
        <NFormItem label="目标国家/地区" required>
          <CrmRegionCascader
            v-model="targetRegionValues"
            :disabled="disabled"
            market-regions
            multiple
            placeholder="选择大区 / 国家 / 城市区域"
            @update:selected-path="emit('update:targetRegionPath', $event)"
            @update:selected-paths="emit('update:targetRegionPaths', $event)"
          />
        </NFormItem>
      </NGi>
    </NGrid>

    <div v-if="productLine" class="product-line-summary">
      <div class="product-line-summary-header">
        <div class="product-line-name">{{ productLine.name }}</div>
        <NTag size="small" type="success" :bordered="false">匹配基准</NTag>
      </div>
      <div v-if="summaryItems.length" class="product-line-facts">
        <div v-for="item in summaryItems" :key="item.label" class="product-line-fact">
          <span class="product-line-fact-label">{{ item.label }}</span>
          <span class="product-line-fact-value">{{ item.value }}</span>
        </div>
      </div>
      <NText v-else depth="3">这条产品线暂未填写详细资料，建议先到 CRM 产品资料补充卖点和常见型号。</NText>
    </div>

    <NGrid :cols="24" :x-gap="12" responsive="screen" item-responsive>
      <NGi span="24 m:12">
        <NFormItem label="搜索关键词 / 型号">
          <NInput
            v-model:value="keywordText"
            clearable
            :disabled="disabled"
            placeholder="默认不用填；优化关键词后 AI 会回显，可再补充型号/品牌"
          />
        </NFormItem>
      </NGi>

      <NGi span="24 m:12">
        <NFormItem label="补充判断规则">
          <NInput
            v-model:value="requirement"
            clearable
            :disabled="disabled"
            placeholder="默认不用填；优化关键词后 AI 会回显判断规则，可人工补充"
          />
        </NFormItem>
      </NGi>
    </NGrid>

    <NFormItem label="客户类型" required>
      <NCheckboxGroup v-model:value="targetCustomerTypeKeys" :disabled="disabled">
        <div class="context-option-grid">
          <NCheckbox
            v-for="option in customerTypeOptions"
            :key="option.key"
            class="context-option"
            :value="option.key"
          >
            <span class="context-option-title">{{ option.label }}</span>
            <span class="context-option-desc">{{ option.description }}</span>
          </NCheckbox>
        </div>
      </NCheckboxGroup>
    </NFormItem>

    <NFormItem label="排除类型">
      <NCheckboxGroup v-model:value="exclusionRuleKeys" :disabled="disabled">
        <div class="context-option-grid">
          <NCheckbox
            v-for="option in exclusionRuleOptions"
            :key="option.key"
            class="context-option"
            :value="option.key"
          >
            <span class="context-option-title">{{ option.label }}</span>
            <span class="context-option-desc">{{ option.description }}</span>
          </NCheckbox>
        </div>
      </NCheckboxGroup>
    </NFormItem>
  </div>
</template>

<style scoped>
.product-line-context {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-line-summary {
  padding: 10px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-modal);
}

.product-line-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.product-line-name {
  min-width: 0;
  overflow: hidden;
  color: var(--n-text-color);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-line-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.product-line-fact {
  display: flex;
  min-width: 0;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.product-line-fact-label {
  flex: 0 0 auto;
  color: var(--n-text-color-3);
}

.product-line-fact-value {
  min-width: 0;
  overflow: hidden;
  color: var(--n-text-color-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-option-grid {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: 8px;
}

.context-option {
  flex: 1 1 220px;
  max-width: 360px;
  align-items: flex-start;
  padding: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
}

.context-option :deep(.n-checkbox__label) {
  min-width: 0;
  padding-left: 8px;
  white-space: normal;
}

.context-option-title,
.context-option-desc {
  display: block;
}

.context-option-title {
  color: var(--n-text-color);
  font-weight: 600;
  line-height: 1.4;
}

.context-option-desc {
  margin-top: 2px;
  color: var(--n-text-color-3);
  font-size: 12px;
  line-height: 1.45;
}
</style>
