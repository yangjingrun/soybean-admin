export const crmWorkbenchRefreshEventName = 'crm:workbench-refresh';
/** Notify mounted workbench consumers that CRM counters should be reloaded. */
export function notifyCrmWorkbenchChanged(target = getCrmWorkbenchRefreshTarget()) {
  target?.dispatchEvent(new Event(crmWorkbenchRefreshEventName));
}
/** Listen for CRM data changes that can affect the home workbench overview. */
export function listenCrmWorkbenchRefresh(callback, target = getCrmWorkbenchRefreshTarget()) {
  if (!target) {
    return () => {};
  }
  const listener = () => {
    callback();
  };
  target.addEventListener(crmWorkbenchRefreshEventName, listener);
  return () => {
    target.removeEventListener(crmWorkbenchRefreshEventName, listener);
  };
}
function getCrmWorkbenchRefreshTarget() {
  return typeof window === 'undefined' ? null : window;
}
