import { request } from '../request';

/** List CRM account leads by filters and pagination. */
export function fetchCrmAccounts(params: Api.Crm.LeadSearchParams) {
  return request<Api.Crm.LeadList>({
    url: '/crm/accounts',
    method: 'get',
    params
  });
}
