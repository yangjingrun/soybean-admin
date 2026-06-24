import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closePendingGmailOAuthTab, openGmailOAuthUrlInTab, openPendingGmailOAuthTab } from './mailbox-oauth-tab';
function createTab() {
  return {
    closed: false,
    location: {
      href: ''
    },
    opener: {},
    close() {
      this.closed = true;
    }
  };
}
describe('mailbox OAuth tab helpers', () => {
  it('opens a pending blank tab from the click event and clears opener', () => {
    const openedTab = createTab();
    const calls = [];
    const openTab = (url, target, features) => {
      calls.push({ features, target, url });
      return openedTab;
    };
    const pendingTab = openPendingGmailOAuthTab(openTab);
    assert.equal(pendingTab, openedTab);
    assert.deepEqual(calls, [{ features: undefined, target: '_blank', url: '' }]);
    assert.equal(openedTab.opener, null);
  });
  it('navigates the pending tab to the Google authorization URL', () => {
    const pendingTab = createTab();
    const opened = openGmailOAuthUrlInTab('https://accounts.google.com/o/oauth2/v2/auth', pendingTab);
    assert.equal(opened, true);
    assert.equal(pendingTab.location.href, 'https://accounts.google.com/o/oauth2/v2/auth');
  });
  it('falls back to a direct secure new tab when the pending tab was blocked', () => {
    const calls = [];
    const fallbackTab = createTab();
    const openTab = (url, target, features) => {
      calls.push({ features, target, url });
      return fallbackTab;
    };
    const opened = openGmailOAuthUrlInTab('https://accounts.google.com/o/oauth2/v2/auth', null, openTab);
    assert.equal(opened, true);
    assert.deepEqual(calls, [
      {
        features: 'noopener,noreferrer',
        target: '_blank',
        url: 'https://accounts.google.com/o/oauth2/v2/auth'
      }
    ]);
  });
  it('closes the blank tab if OAuth URL creation fails', () => {
    const pendingTab = createTab();
    closePendingGmailOAuthTab(pendingTab);
    assert.equal(pendingTab.closed, true);
  });
});
