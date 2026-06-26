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
    const nextStatus = thread.status === 'bounced' ? 'bounced' : 'handled';
    if (thread.status === nextStatus && thread.unreadCount === 0) return null;

    return {
      nextStatus: nextStatus as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为已读',
      data: {
        status: nextStatus,
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_added' && labelIds.has('UNREAD')) {
    const nextStatus = thread.status === 'bounced' ? 'bounced' : 'pending';
    if (thread.status === nextStatus && thread.unreadCount > 0) return null;

    return {
      nextStatus: nextStatus as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为未读',
      data: {
        status: nextStatus,
        unreadCount: Math.max(thread.unreadCount, 1)
      }
    };
  }

  return null;
}
