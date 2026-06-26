import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  builtinDirectorySourceRules,
  isDirectorySourceUrl,
  normalizeDirectorySourceRuleValue,
  type AiLeadDirectorySourceMatcherRule
} from './ai-lead-source-url';
import { AI_LEAD_DIRECTORY_SOURCE_RULE_STORE } from './ai-leads.tokens';
import type {
  AiLeadDirectorySourceRuleInput,
  AiLeadDirectorySourceRuleRecord,
  AiLeadDirectorySourceRuleStore,
  AiLeadDirectorySourceRuleUpdateInput
} from './ai-lead-directory-source-rule.types';

@Injectable()
export class AiLeadDirectorySourceRuleService {
  constructor(
    @Optional()
    @Inject(AI_LEAD_DIRECTORY_SOURCE_RULE_STORE)
    private readonly ruleStore?: AiLeadDirectorySourceRuleStore
  ) {}

  /** 返回内置规则和超级管理员配置的自定义规则。 */
  async listRules() {
    const customRules = await this.listCustomRules();

    return [...this.listBuiltinRules(), ...customRules];
  }

  /** 返回搜索过滤可直接使用的启用规则。 */
  async listEnabledMatcherRules(): Promise<AiLeadDirectorySourceMatcherRule[]> {
    const rules = await this.listRules();

    return rules
      .filter(rule => rule.enabled)
      .map(rule => ({
        value: rule.value,
        matchMode: rule.matchMode,
        enabled: rule.enabled
      }));
  }

  createRule(input: AiLeadDirectorySourceRuleInput) {
    return this.requireStore().createRule(this.normalizeInput(input));
  }

  updateRule(input: AiLeadDirectorySourceRuleUpdateInput) {
    return this.requireStore().updateRule({
      ...this.normalizeInput(input),
      id: input.id
    });
  }

  deleteRule(id: string) {
    return this.requireStore().deleteRule(id);
  }

  /** 用当前规则判断一个链接是否为目录/黄页来源。 */
  async isDirectorySourceUrl(value: string | null | undefined) {
    return isDirectorySourceUrl(value, await this.listEnabledMatcherRules());
  }

  private listBuiltinRules(): AiLeadDirectorySourceRuleRecord[] {
    const now = new Date(0);

    return builtinDirectorySourceRules.map(rule => ({
      id: `builtin:${rule.matchMode}:${rule.value}`,
      value: rule.value,
      matchMode: rule.matchMode,
      enabled: rule.enabled !== false,
      builtin: true,
      description: '系统内置黄页/目录域名',
      createdAt: now,
      updatedAt: now
    }));
  }

  private listCustomRules() {
    return this.ruleStore?.listRules() ?? Promise.resolve([]);
  }

  private normalizeInput(input: AiLeadDirectorySourceRuleInput) {
    return {
      ...input,
      value: normalizeDirectorySourceRuleValue(input.value, input.matchMode),
      description: normalizeNullableText(input.description),
      user: input.user
    };
  }

  private requireStore() {
    if (!this.ruleStore) {
      throw new Error('AI 获客黄页过滤规则存储未配置');
    }

    return this.ruleStore;
  }
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized || null;
}
