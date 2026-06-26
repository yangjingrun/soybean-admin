<script setup lang="ts">
import type { SelectOption } from 'naive-ui';
import type { ProductLineSummaryItem } from './shared';

const productLineId = defineModel<string | null>('productLineId', { required: true });

defineProps<{
  disabled?: boolean;
  loading?: boolean;
  options: SelectOption[];
  productLine: Api.Crm.ProductLineRecord | null;
  summaryItems: ProductLineSummaryItem[];
}>();
</script>

<template>
  <div class="product-line-context">
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
</style>
