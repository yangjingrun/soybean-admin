import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatHistoryTargetRegions } from './history-display';

describe('ai leads history display helpers', () => {
  it('formats English target regions as Chinese labels', () => {
    assert.equal(formatHistoryTargetRegions('Saudi Arabia'), '沙特阿拉伯');
    assert.equal(formatHistoryTargetRegions('United Arab Emirates'), '阿联酋');
  });

  it('keeps existing Chinese target regions readable', () => {
    assert.equal(formatHistoryTargetRegions('沙特阿拉伯'), '沙特阿拉伯');
  });

  it('formats multiple target regions consistently', () => {
    assert.equal(formatHistoryTargetRegions('South Korea, Mexico'), '韩国、墨西哥');
  });
});
