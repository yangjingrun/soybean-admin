import { request } from '../../request';
/** List CRM inbound reply threads by filters and pagination. */
export function fetchCrmInboxThreads(params) {
  return request({
    url: '/crm/inbox-threads',
    method: 'get',
    params
  });
}
/** Get one CRM inbound reply thread with messages and related CRM records. */
export function fetchCrmInboxThreadDetail(id) {
  return request({
    url: `/crm/inbox-threads/${id}`,
    method: 'get'
  });
}
/** Update the handling status of one inbound reply thread. */
export function updateCrmInboxThreadStatus(id, data) {
  return request({
    url: `/crm/inbox-threads/${id}/status`,
    method: 'patch',
    data
  });
}
/** Polish a user-provided reply topic into a local reply draft without sending Gmail. */
export function polishCrmInboxReplyDraft(id, data) {
  return request({
    url: `/crm/inbox-threads/${id}/ai-reply-polish`,
    method: 'post',
    data
  });
}
/** Save a local CRM inbox reply draft without sending Gmail. */
export function saveCrmInboxReplyDraft(id, data) {
  return request({
    url: `/crm/inbox-threads/${id}/reply-draft`,
    method: 'patch',
    data
  });
}
/** Confirm one suspected unsubscribe inbox message and apply blacklist changes. */
export function confirmCrmInboxMessageUnsubscribe(id) {
  return request({
    url: `/crm/inbox-messages/${id}/confirm-unsubscribe`,
    method: 'post'
  });
}
/** Reply to one CRM inbox thread with plain text from the bound mailbox. */
export function replyCrmInboxThread(id, data) {
  return request({
    url: `/crm/inbox-threads/${id}/reply`,
    method: 'post',
    data
  });
}
