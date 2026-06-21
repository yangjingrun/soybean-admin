export const crmWorkbenchRefreshEventName = 'crm:workbench-refresh';

type CrmWorkbenchRefreshTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;

/** Notify mounted workbench consumers that CRM counters should be reloaded. */
export function notifyCrmWorkbenchChanged(target: CrmWorkbenchRefreshTarget | null = getCrmWorkbenchRefreshTarget()) {
  target?.dispatchEvent(new Event(crmWorkbenchRefreshEventName));
}

/** Listen for CRM data changes that can affect the home workbench overview. */
export function listenCrmWorkbenchRefresh(
  callback: () => void,
  target: CrmWorkbenchRefreshTarget | null = getCrmWorkbenchRefreshTarget()
) {
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

function getCrmWorkbenchRefreshTarget(): CrmWorkbenchRefreshTarget | null {
  return typeof window === 'undefined' ? null : window;
}
