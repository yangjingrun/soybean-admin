const gmailOAuthTabTarget = '_blank';
const gmailOAuthSecureTabFeatures = 'noopener,noreferrer';
function getBrowserOpenTab() {
  return window.open.bind(window);
}
/** Opens a blank tab during the user's click event so Google OAuth is less likely to be blocked. */
export function openPendingGmailOAuthTab(openTab = getBrowserOpenTab()) {
  const pendingTab = openTab('', gmailOAuthTabTarget);
  if (pendingTab) {
    pendingTab.opener = null;
  }
  return pendingTab;
}
/** Navigates a pending tab to Google OAuth, or tries a direct new tab when the blank tab was blocked. */
export function openGmailOAuthUrlInTab(authorizationUrl, pendingTab, openTab) {
  if (pendingTab) {
    pendingTab.location.href = authorizationUrl;
    return true;
  }
  const browserOpenTab = openTab ?? getBrowserOpenTab();
  return browserOpenTab(authorizationUrl, gmailOAuthTabTarget, gmailOAuthSecureTabFeatures) !== null;
}
/** Closes the blank OAuth tab when URL creation fails before Google is opened. */
export function closePendingGmailOAuthTab(pendingTab) {
  pendingTab?.close();
}
