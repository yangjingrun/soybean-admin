import type { CrmInboxThreadGmailStateSyncInput, CrmInboxThreadRecord, CrmInboxThreadStatus } from '../crm.types';

/** Resolves local inbox-thread state changes from Gmail history label changes. */
export function resolveGmailThreadStateUpdate(
  thread: Pick<CrmInboxThreadRecord, 'status' | 'unreadCount'>,
  input: Pick<CrmInboxThreadGmailStateSyncInput, 'changeType' | 'labelIds'>
) {
  const labelIds = new Set(input.labelIds);
  const isArchived =
    input.changeType === 'message_deleted' ||
    (input.changeType === 'labels_removed' && labelIds.has('INBOX')) ||
    (input.changeType === 'labels_added' && labelIds.has('TRASH'));

  if (isArchived) {
    if (thread.status === 'archived' && thread.unreadCount === 0) return null;

    return {
      nextStatus: 'archived' as CrmInboxThreadStatus,
      eventType: 'gmail_thread_archived',
      title: 'Gmail 状态同步为归档',
      data: {
        status: 'archived',
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_removed' && labelIds.has('UNREAD')) {
    if (thread.status === 'handled' && thread.unreadCount === 0) return null;

    return {
      nextStatus: 'handled' as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为已读',
      data: {
        status: 'handled',
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_added' && labelIds.has('UNREAD')) {
    if (thread.status === 'pending' && thread.unreadCount > 0) return null;

    return {
      nextStatus: 'pending' as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为未读',
      data: {
        status: 'pending',
        unreadCount: Math.max(thread.unreadCount, 1)
      }
    };
  }

  return null;
}
