import { request } from '../../request';
/** List CRM mailboxes by filters and pagination. */
export function fetchCrmMailboxes(params) {
  return request({
    url: '/crm/mailboxes',
    method: 'get',
    params
  });
}
/** Create the Google OAuth consent URL for authorizing a Gmail mailbox. */
export function createCrmGmailOAuthUrl() {
  return request({
    url: '/crm/mailboxes/gmail/oauth-url',
    method: 'post'
  });
}
/** Complete Gmail OAuth after Google redirects back with code and state. */
export function completeCrmGmailOAuthCallback(data) {
  return request({
    url: '/crm/mailboxes/gmail/oauth-callback',
    method: 'post',
    data
  });
}
/** Pause one CRM mailbox. */
export function pauseCrmMailbox(id) {
  return request({
    url: `/crm/mailboxes/${id}/pause`,
    method: 'patch'
  });
}
/** Resume one CRM mailbox. */
export function resumeCrmMailbox(id) {
  return request({
    url: `/crm/mailboxes/${id}/resume`,
    method: 'patch'
  });
}
/** Cancel one CRM Gmail authorization while keeping the mailbox record. */
export function revokeCrmMailboxAuthorization(id) {
  return request({
    url: `/crm/mailboxes/${id}/revoke-authorization`,
    method: 'patch'
  });
}
/** Delete one unavailable CRM mailbox and release the Gmail address. */
export function deleteCrmMailbox(id) {
  return request({
    url: `/crm/mailboxes/${id}`,
    method: 'delete'
  });
}
/** Renew Gmail watch for one active CRM mailbox. */
export function renewCrmMailboxWatch(id) {
  return request({
    url: `/crm/mailboxes/${id}/renew-watch`,
    method: 'post'
  });
}
/** Enqueue an immediate Gmail history sync for one active CRM mailbox. */
export function syncCrmMailboxNow(id) {
  return request({
    url: `/crm/mailboxes/${id}/sync-now`,
    method: 'post'
  });
}
/** Reconcile stale CRM send queue jobs that disappeared from BullMQ. */
export function reconcileCrmSendQueue() {
  return request({
    url: '/crm/operations/send-queue/reconcile',
    method: 'post'
  });
}
