declare namespace Api {
  namespace SystemOrganization {
    type OrganizationStatus = 'enabled' | 'disabled';

    interface OrganizationListItem {
      id: string;
      name: string;
      status: OrganizationStatus;
      userCount: number;
      adminCount: number;
      createdAt: string;
      updatedAt: string;
    }

    interface OrganizationSelectItem {
      id: string;
      name: string;
    }

    interface OrganizationSearchParams extends Api.Common.CommonSearchParams {
      keyword?: string;
      status?: OrganizationStatus;
    }

    interface OrganizationFilterModel {
      keyword: string;
      status: OrganizationStatus | null;
    }

    interface OrganizationOperatePayload {
      name: string;
      status?: OrganizationStatus;
    }

    interface OrganizationStatusPayload {
      status: OrganizationStatus;
    }

    type OrganizationList = Api.Common.PaginatingQueryRecord<OrganizationListItem>;
  }
}
