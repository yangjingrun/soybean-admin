/** Handles the route action as the user's explicit acknowledgement of the notification. */
export async function handleSystemNotificationRouteAction(input) {
  input.destroyNotice();
  await input.markRead(input.id);
  await input.pushRoute(input.routePath);
}
