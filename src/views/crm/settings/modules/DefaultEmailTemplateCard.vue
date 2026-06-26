<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  loading?: boolean;
  templateDefaults: Api.Crm.TemplateDefaults | null;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const firstStep = computed(() => props.templateDefaults?.templateGroup.steps[0] ?? null);
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper" title="当前默认开发信模板">
    <template #header-extra>
      <NButton size="tiny" :loading="loading" @click="emit('refresh')">刷新</NButton>
    </template>

    <NSpin :show="loading">
      <NSpace v-if="templateDefaults" vertical :size="12">
        <NText depth="3">系统新建开发信时，默认用这套模板写首封和后续跟进。</NText>

        <NDescriptions label-placement="left" bordered :column="1" size="small">
          <NDescriptionsItem label="模板">{{ templateDefaults.templateGroup.name }}</NDescriptionsItem>
          <NDescriptionsItem label="语言">{{ templateDefaults.templateGroup.language }}</NDescriptionsItem>
          <NDescriptionsItem label="跟进封数">{{ templateDefaults.templateGroup.steps.length }} 封</NDescriptionsItem>
        </NDescriptions>

        <NCollapse>
          <NCollapseItem title="展开查看首封内容和可用变量" name="detail">
            <NSpace vertical :size="12">
              <NSpace vertical :size="8">
                <NText strong>首封模板</NText>
                <NDescriptions v-if="firstStep" label-placement="left" bordered :column="1" size="small">
                  <NDescriptionsItem label="主题">
                    {{ firstStep.subjectTemplate || '沿用上一封主题' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="发送方式">
                    {{ firstStep.threadMode === 'same_thread' ? '同线程' : '新主题' }}
                  </NDescriptionsItem>
                </NDescriptions>
                <NCode v-if="firstStep" :code="firstStep.bodyTemplate" language="text" word-wrap />
              </NSpace>

              <NSpace vertical :size="8">
                <NText strong>可用变量</NText>
                <NSpace :size="6" wrap>
                  <NTag
                    v-for="variable in templateDefaults.templateGroup.variables"
                    :key="variable.key"
                    :bordered="false"
                    size="small"
                  >
                    {{ variable.label }} · {{ variable.source }}
                  </NTag>
                </NSpace>
              </NSpace>
            </NSpace>
          </NCollapseItem>
        </NCollapse>
      </NSpace>

      <NEmpty v-else description="暂无模板配置" />
    </NSpin>
  </NCard>
</template>
