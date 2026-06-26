import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const modalSource = readFileSync(new URL('./DraftReviewModal.vue', import.meta.url), 'utf8');

describe('DraftReviewModal email content copy affordance', () => {
  it('keeps subject and body selectable when the draft cannot be edited', () => {
    const readonlyMatches = modalSource.match(/:readonly="!canEdit"/g) ?? [];

    assert.equal(readonlyMatches.length, 2);
    assert.doesNotMatch(modalSource, /:disabled="!canEdit"/);
  });

  it('exposes copy actions for both the subject and body fields', () => {
    assert.match(modalSource, /function copyDraftField/);
    assert.match(modalSource, /navigator\.clipboard\.writeText/);
    assert.match(modalSource, /copyDraftField\('subject'\)/);
    assert.match(modalSource, /copyDraftField\('bodyText'\)/);
  });

  it('places copy controls at the top-right corner of each input box', () => {
    assert.match(modalSource, /class="draft-copy-field"/);
    assert.match(modalSource, /class="draft-copy-field draft-copy-field--textarea"/);
    assert.match(modalSource, /class="draft-copy-field__button"/);
    assert.match(modalSource, /top:\s*0;/);
    assert.match(modalSource, /transform:\s*translateY\(-50%\);/);
    assert.doesNotMatch(modalSource, /class="draft-field-label"/);
  });
});

describe('DraftReviewModal open tracking detail', () => {
  it('shows readable open tracking details for the selected message', () => {
    assert.match(modalSource, /buildOpenTrackingRows/);
    assert.match(modalSource, /const openTrackingRows = computed/);
    assert.match(modalSource, /title="打开详情"/);
    assert.match(modalSource, /currentMessage\.value\?\.openTracking/);
    assert.match(modalSource, /openTrackingRows/);
  });
});
