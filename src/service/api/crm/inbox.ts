import { request } from '../../request';

/** List CRM inbound reply threads by filters and pagination. */
export function fetchCrmInboxThreads(params: Api.Crm.InboxThreadSearchParams) {
  return request<Api.Crm.InboxThreadList>({
    url: '/crm/inbox-threads',
    method: 'get',
    params
  });
}

/** Get one CRM inbound reply thread with messages and related CRM records. */
export function fetchCrmInboxThreadDetail(id: string) {
  return request<Api.Crm.InboxThreadDetail>({
    url: `/crm/inbox-threads/${id}`,
    method: 'get'
  });
}

/** Update the handling status of one inbound reply thread. */
export function updateCrmInboxThreadStatus(id: string, data: Api.Crm.InboxThreadStatusPayload) {
  return request<Api.Crm.InboxThreadStatusResult>({
    url: `/crm/inbox-threads/${id}/status`,
    method: 'patch',
    data
  });
}

/** Polish a user-provided reply topic into a local reply draft without sending Gmail. */
export function polishCrmInboxReplyDraft(id: string, data: Api.Crm.InboxReplyPolishPayload) {
  return request<Api.Crm.InboxThreadDetail>({
    url: `/crm/inbox-threads/${id}/ai-reply-polish`,
    method: 'post',
    data
  });
}

/** Save a local CRM inbox reply draft without sending Gmail. */
export function saveCrmInboxReplyDraft(id: string, data: Api.Crm.InboxReplyDraftPayload) {
  return request<Api.Crm.InboxThreadDetail>({
    url: `/crm/inbox-threads/${id}/reply-draft`,
    method: 'patch',
    data
  });
}

/** Confirm one suspected unsubscribe inbox message and apply blacklist changes. */
export function confirmCrmInboxMessageUnsubscribe(id: string) {
  return request<Api.Crm.InboxUnsubscribeConfirmResult>({
    url: `/crm/inbox-messages/${id}/confirm-unsubscribe`,
    method: 'post'
  });
}

/** Reply to one CRM inbox thread with plain text from the bound mailbox. */
export function replyCrmInboxThread(id: string, data: Api.Crm.InboxReplyPayload) {
  return request<Api.Crm.InboxThreadDetail>({
    url: `/crm/inbox-threads/${id}/reply`,
    method: 'post',
    data
  });
}
