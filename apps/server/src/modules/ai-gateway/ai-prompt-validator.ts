import {
  aiPromptOutputTopLevelFields,
  aiPromptRequiredTextRules,
  type AiPromptKey
} from './ai-gateway.constants';
import type { AiPromptValidationItem, AiPromptValidationResult, AiPromptValidationStatus } from './ai-gateway.types';

type JsonRecord = Record<string, unknown>;

const mapsRequestBodyKeys = new Set(['q', 'hl', 'll', 'page', 'placeId', 'cid']);
const pollutedMapsQueryPattern = /\b(?:site|inurl|allintitle|intitle):|[（）()]|(?:\s+OR\s+)|(?:\s+AND\s+)/i;

/** Validates static prompt text before it can be tested or published. */
export function validateAiPromptText(promptKey: string, systemPrompt: string): AiPromptValidationResult {
  const normalizedKey = promptKey as AiPromptKey;
  const trimmedPrompt = systemPrompt.trim();
  const items: AiPromptValidationItem[] = [
    createItem(
      'prompt-non-empty',
      '提示词非空',
      trimmedPrompt ? 'pass' : 'fail',
      trimmedPrompt ? '系统提示词已填写' : '系统提示词不能为空'
    )
  ];

  const requiredRules = aiPromptRequiredTextRules[normalizedKey] ?? [];
  const missingRules = requiredRules.filter(rule => !trimmedPrompt.includes(rule));

  items.push(
    createItem(
      'prompt-required-rules',
      '关键规则完整',
      missingRules.length === 0 ? 'pass' : 'fail',
      missingRules.length === 0 ? '关键规则已覆盖' : `缺少规则：${missingRules.join('、')}`
    )
  );

  return toResult(items);
}

/** Validates model JSON output against the selected business step policy. */
export function validateAiPromptOutput(promptKey: string, output: unknown): AiPromptValidationResult {
  const parsed = parseOutput(output);
  const items: AiPromptValidationItem[] = [
    createItem(
      'json-object',
      'JSON 对象约束',
      parsed ? 'pass' : 'fail',
      parsed ? '输出是合法 JSON 对象' : '输出必须是合法 JSON 对象'
    )
  ];

  if (!parsed) {
    return toResult(items);
  }

  const normalizedKey = promptKey as AiPromptKey;

  items.push(validateTopLevelFields(normalizedKey, parsed));

  if (normalizedKey === 'lead_maps_keyword_optimize') {
    items.push(...validateMapsOutput(parsed));
  }

  return toResult(items);
}

function validateTopLevelFields(promptKey: AiPromptKey, output: JsonRecord): AiPromptValidationItem {
  const expectedFields = aiPromptOutputTopLevelFields[promptKey] ?? [];

  if (expectedFields.length === 0) {
    return createItem('top-level-fields', '顶层字段完整', 'warn', '该步骤暂未配置严格顶层字段校验');
  }

  const expectedSet = new Set(expectedFields);
  const actualFields = Object.keys(output);
  const missingFields = expectedFields.filter(field => !(field in output));
  const extraFields = actualFields.filter(field => !expectedSet.has(field));
  const ok = missingFields.length === 0 && extraFields.length === 0;

  return createItem(
    'top-level-fields',
    '顶层字段完整',
    ok ? 'pass' : 'fail',
    ok ? '顶层字段符合约定' : `缺少字段：${missingFields.join('、') || '无'}；多余字段：${extraFields.join('、') || '无'}`
  );
}

function validateMapsOutput(output: JsonRecord): AiPromptValidationItem[] {
  const searchQueries = readArray(output.serperSearchQueries);
  const placesQueries = readArray(output.serperPlacesQueries);
  const mapsQueries = readArray(output.serperMapsQueries);

  return [
    createItem(
      'search-empty',
      'Search 查询为空',
      searchQueries.length === 0 ? 'pass' : 'fail',
      searchQueries.length === 0 ? 'serperSearchQueries 为空' : '地图模式不应输出 serperSearchQueries'
    ),
    createItem(
      'places-empty',
      'Places 查询为空',
      placesQueries.length === 0 ? 'pass' : 'fail',
      placesQueries.length === 0 ? 'serperPlacesQueries 为空' : '地图模式不应输出 serperPlacesQueries'
    ),
    createItem(
      'maps-query-count',
      'Maps 查询数量',
      mapsQueries.length >= 5 && mapsQueries.length <= 8 ? 'pass' : 'fail',
      mapsQueries.length >= 5 && mapsQueries.length <= 8
        ? 'serperMapsQueries 数量为 5-8 条'
        : `serperMapsQueries 当前为 ${mapsQueries.length} 条，应为 5-8 条`
    ),
    validateMapsQuerySyntax(mapsQueries)
  ];
}

function validateMapsQuerySyntax(mapsQueries: unknown[]): AiPromptValidationItem {
  const invalidIndex = mapsQueries.findIndex(query => !isValidMapsQuery(query));

  return createItem(
    'maps-query-syntax',
    'Maps 查询语法',
    invalidIndex === -1 ? 'pass' : 'fail',
    invalidIndex === -1
      ? 'Maps 查询均为短商家搜索词'
      : `第 ${invalidIndex + 1} 条 Maps 查询包含搜索引擎语法、中文备注或非法字段`
  );
}

function isValidMapsQuery(query: unknown) {
  if (!isRecord(query) || query.endpoint !== 'maps' || !isRecord(query.requestBody)) {
    return false;
  }

  const requestBody = query.requestBody;
  const q = typeof requestBody.q === 'string' ? requestBody.q.trim() : '';

  if (!q || pollutedMapsQueryPattern.test(q)) {
    return false;
  }

  return Object.keys(requestBody).every(key => mapsRequestBodyKeys.has(key));
}

function parseOutput(output: unknown): JsonRecord | null {
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output);

      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(output) ? output : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createItem(
  key: string,
  label: string,
  status: AiPromptValidationStatus,
  message: string
): AiPromptValidationItem {
  return {
    key,
    label,
    status,
    message
  };
}

function toResult(items: AiPromptValidationItem[]): AiPromptValidationResult {
  return {
    ok: items.every(item => item.status !== 'fail'),
    items
  };
}
