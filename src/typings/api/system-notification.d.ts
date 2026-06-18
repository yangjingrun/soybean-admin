declare namespace Api {
  namespace SystemNotification {
    type NotificationStatus = 'pending' | 'shown' | 'read';

    interface SystemNotification {
      id: string;
      userId: string;
      userName: string | null;
      module: string;
      type: string;
      title: string;
      content: string;
      targetType: string | null;
      targetId: string | null;
      routePath: string | null;
      status: NotificationStatus;
      shownAt: string | null;
      readAt: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      updatedAt: string;
    }
  }
}
