interface SystemNotificationRouteActionInput {
  id: string;
  routePath: string;
  destroyNotice: () => void;
  markRead: (id: string) => Promise<unknown>;
  pushRoute: (routePath: string) => Promise<unknown>;
}

/** Handles the route action as the user's explicit acknowledgement of the notification. */
export async function handleSystemNotificationRouteAction(input: SystemNotificationRouteActionInput) {
  input.destroyNotice();
  await input.markRead(input.id);
  await input.pushRoute(input.routePath);
}
