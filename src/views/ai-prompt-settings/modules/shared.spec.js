import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPromptSectionAnchors,
  formatLatestPromptTestRunForCopy,
  resolvePromptPublishBlockReason,
  resolvePromptValidationSection,
  resolvePromptLineStartOffset,
  summarizePromptValidation,
  resolvePromptStepStatus
} from './shared';
describe('ai prompt settings shared helpers', () => {
  it('prioritizes draft and failed test states in step status labels', () => {
    assert.deepEqual(
      resolvePromptStepStatus({
        promptKey: 'lead_maps_keyword_optimize',
        title: '地图关键词优化',
        usage: '',
        channel: 'maps',
        published: null,
        draft: {
          id: 'draft',
          promptKey: 'lead_maps_keyword_optimize',
          title: '地图关键词优化',
          version: 0,
          lifecycle: 'draft',
          systemPrompt: 'prompt',
          validationResult: null,
          changeNote: null,
          createdById: null,
          createdByName: null,
          publishedAt: null,
          createdAt: '',
          updatedAt: ''
        },
        latestTestRun: null
      }).label,
      '有草稿'
    );
    assert.deepEqual(
      resolvePromptStepStatus({
        promptKey: 'lead_maps_keyword_optimize',
        title: '地图关键词优化',
        usage: '',
        channel: 'maps',
        published: {
          promptKey: 'lead_maps_keyword_optimize',
          title: '地图关键词优化',
          systemPrompt: 'prompt',
          updatedAt: ''
        },
        draft: null,
        latestTestRun: {
          id: 'test',
          promptKey: 'lead_maps_keyword_optimize',
          inputPrompt: 'test',
          outputText: null,
          validationResult: null,
          success: false,
          durationMs: 200,
          errorMessage: 'failed',
          createdById: null,
          createdByName: null,
          createdAt: ''
        }
      }).label,
      '测试失败'
    );
  });
  it('summarizes validation checklist counts', () => {
    assert.deepEqual(
      summarizePromptValidation({
        ok: false,
        items: [
          { key: 'json-object', label: 'JSON', status: 'pass', message: 'ok' },
          { key: 'top-level-fields', label: '字段', status: 'fail', message: 'missing' },
          { key: 'legacy', label: '旧规则', status: 'warn', message: 'warn' }
        ]
      }),
      {
        ok: false,
        passCount: 1,
        warnCount: 1,
        failCount: 1,
        label: '1 项需修复'
      }
    );
  });
  it('builds prompt editor anchors from known section headings', () => {
    assert.deepEqual(
      buildPromptSectionAnchors(`
你是 Maps Agent
Serper Maps 渠道规则：
- Maps 是唯一渠道
关键词维度覆盖要求：
硬性规则：
输出 JSON 结构必须严格如下：
searchExecutionRules
`),
      [
        { key: 'role', label: '角色定义', line: 2 },
        { key: 'channel', label: '渠道规则', line: 3 },
        { key: 'keyword', label: '关键词维度', line: 5 },
        { key: 'hard-rules', label: '硬性规则', line: 6 },
        { key: 'output', label: '输出结构', line: 7 }
      ]
    );
  });
  it('resolves prompt line start offsets for anchor navigation', () => {
    const prompt = ['第一段', '第二段内容', '第三段'].join('\n');
    assert.equal(resolvePromptLineStartOffset(prompt, 1), 0);
    assert.equal(resolvePromptLineStartOffset(prompt, 2), '第一段\n'.length);
    assert.equal(resolvePromptLineStartOffset(prompt, 3), '第一段\n第二段内容\n'.length);
    assert.equal(resolvePromptLineStartOffset(prompt, 99), prompt.length - '第三段'.length);
  });
  it('maps validation items to prompt sections for repair shortcuts', () => {
    assert.deepEqual(
      resolvePromptValidationSection({
        key: 'top-level-fields',
        label: '顶层字段完整',
        status: 'fail',
        message: '缺少字段'
      }),
      {
        key: 'output',
        label: '输出结构',
        line: 0
      }
    );
    assert.deepEqual(
      resolvePromptValidationSection({
        key: 'maps-query-syntax',
        label: 'Maps 查询语法',
        status: 'fail',
        message: '语法错误'
      }),
      {
        key: 'channel',
        label: '渠道规则',
        line: 0
      }
    );
    assert.equal(
      resolvePromptValidationSection({
        key: 'legacy',
        label: '旧规则',
        status: 'warn',
        message: '待人工确认'
      }),
      null
    );
  });
  it('formats latest test result for clipboard copy', () => {
    assert.equal(
      formatLatestPromptTestRunForCopy({
        id: 'test-1',
        promptKey: 'lead_keyword_optimize',
        inputPrompt: '轴承经销商',
        outputText: '{\n  "ok": true\n}',
        validationResult: {
          ok: false,
          items: [{ key: 'top-level-fields', label: '顶层字段完整', status: 'fail', message: '缺少 buyerSegments' }]
        },
        success: false,
        durationMs: 123,
        errorMessage: '模型输出未通过提示词规则校验',
        createdById: null,
        createdByName: null,
        createdAt: ''
      }),
      [
        '测试结果：失败',
        '错误信息：模型输出未通过提示词规则校验',
        '校验问题：',
        '- 顶层字段完整：缺少 buyerSegments',
        '',
        '{',
        '  "ok": true',
        '}'
      ].join('\n')
    );
  });
  it('resolves publish blocker message by priority', () => {
    assert.equal(
      resolvePromptPublishBlockReason({
        hasDraft: true,
        isDirty: true,
        hasFreshValidationResult: true,
        validationPassed: true
      }),
      ''
    );
    assert.equal(
      resolvePromptPublishBlockReason({
        hasDraft: true,
        isDirty: false,
        hasFreshValidationResult: false,
        validationPassed: false
      }),
      '请先重新校验或运行测试'
    );
    assert.equal(
      resolvePromptPublishBlockReason({
        hasDraft: true,
        isDirty: false,
        hasFreshValidationResult: true,
        validationPassed: false
      }),
      '请先修复校验问题后再发布'
    );
    assert.equal(
      resolvePromptPublishBlockReason({
        hasDraft: true,
        isDirty: false,
        hasFreshValidationResult: true,
        validationPassed: true
      }),
      ''
    );
  });
});
