import { resolveRequestUserDisplayName, type RequestUserContext } from '../../../shared/request-context';

export type CrmUserContext = RequestUserContext;

/** Resolve the customer-visible sender name for CRM outreach and replies. */
export function resolveCrmSenderName(context: CrmUserContext) {
  return resolveRequestUserDisplayName(context);
}
