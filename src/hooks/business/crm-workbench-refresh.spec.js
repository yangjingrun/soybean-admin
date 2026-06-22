import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listenCrmWorkbenchRefresh, notifyCrmWorkbenchChanged } from './crm-workbench-refresh';
describe('crm workbench refresh event', () => {
  it('notifies listeners and supports cleanup', () => {
    const target = new EventTarget();
    let refreshCount = 0;
    const cleanup = listenCrmWorkbenchRefresh(() => {
      refreshCount += 1;
    }, target);
    notifyCrmWorkbenchChanged(target);
    assert.equal(refreshCount, 1);
    cleanup();
    notifyCrmWorkbenchChanged(target);
    assert.equal(refreshCount, 1);
  });
});
