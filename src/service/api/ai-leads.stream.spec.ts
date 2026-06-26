import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flushLeadSearchStreamBuffer, parseLeadSearchStreamChunk } from './ai-leads.stream-parser';

describe('ai leads stream helpers', () => {
  it('parses split NDJSON lines across chunks', () => {
    const events: Api.AiLeads.LeadSearchProgressEvent[] = [];
    let buffer = '';

    buffer = parseLeadSearchStreamChunk(buffer, '{"type":"workflow_started","title":"开始', event =>
      events.push(event)
    );
    buffer = parseLeadSearchStreamChunk(
      buffer,
      '搜索采集"}\n{"type":"step_progress","title":"采集公开线索"}\n',
      event => events.push(event)
    );

    assert.equal(buffer, '');
    assert.deepEqual(events, [
      { type: 'workflow_started', title: '开始搜索采集' },
      { type: 'step_progress', title: '采集公开线索' }
    ]);
  });

  it('flushes the last line even when the stream has no trailing newline', () => {
    const events: Api.AiLeads.LeadSearchProgressEvent[] = [];

    flushLeadSearchStreamBuffer('{"type":"workflow_completed","title":"采集完成"}', event => events.push(event));

    assert.deepEqual(events, [{ type: 'workflow_completed', title: '采集完成' }]);
  });

  it('ignores blank NDJSON lines', () => {
    const events: Api.AiLeads.LeadSearchProgressEvent[] = [];
    const buffer = parseLeadSearchStreamChunk('', '\n  \n{"type":"workflow_started"}\n', event => events.push(event));

    assert.equal(buffer, '');
    assert.deepEqual(events, [{ type: 'workflow_started' }]);
  });
});
