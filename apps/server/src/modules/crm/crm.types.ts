export type OrganizationRole = 'member' | 'admin';

export type CrmAccountStatus =
  | 'candidate'
  | 'missing_contact'
  | 'email_verification_pending'
  | 'manual_review_pending'
  | 'ready'
  | 'sequence_running'
  | 'replied_pending'
  | 'followed_up'
  | 'opportunity'
  | 'customer'
  | 'invalid'
  | 'paused'
  | 'blocked'
  | 'archived';

export type CrmEmailStatus = 'unchecked' | 'valid' | 'invalid' | 'risky' | 'unreachable';

export interface CrmUserContext {
  userId: string;
  userName: string;
  roles: string[];
  organizationId: string;
  organizationRole: OrganizationRole;
}

export interface ImportCrmLeadInput {
  name: string;
  websiteUrl?: string | null;
  country?: string | null;
  customerType?: string | null;
  sourceTaskId?: string | null;
  contact?: {
    fullName?: string | null;
    title?: string | null;
    email?: string | null;
  } | null;
}

export interface CrmAccountRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  normalizedName: string;
  websiteUrl: string | null;
  domain: string | null;
  country: string | null;
  customerType: string | null;
  status: CrmAccountStatus;
  sourceTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmContactRecord {
  id: string;
  organizationId: string;
  accountId: string;
  ownerUserId: string;
  fullName: string | null;
  title: string | null;
  email: string;
  emailHash: string;
  maskedEmail: string;
  isPublicEmail: boolean;
  emailStatus: CrmEmailStatus;
  sourceTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmTimelineEventRecord {
  id: string;
  organizationId: string;
  accountId: string;
  contactId: string | null;
  ownerUserId: string;
  eventType: string;
  title: string;
  content: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface CrmAccountCreateInput {
  organizationId: string;
  ownerUserId: string;
  name: string;
  normalizedName: string;
  websiteUrl?: string | null;
  domain?: string | null;
  country?: string | null;
  customerType?: string | null;
  status: CrmAccountStatus;
  sourceTaskId?: string | null;
}

export interface CrmAccountUpdateInput {
  name?: string;
  normalizedName?: string;
  websiteUrl?: string | null;
  domain?: string | null;
  country?: string | null;
  customerType?: string | null;
  status?: CrmAccountStatus;
  sourceTaskId?: string | null;
}

export interface CrmContactCreateInput {
  organizationId: string;
  accountId: string;
  ownerUserId: string;
  fullName?: string | null;
  title?: string | null;
  email: string;
  emailHash: string;
  maskedEmail: string;
  isPublicEmail: boolean;
  emailStatus: CrmEmailStatus;
  sourceTaskId?: string | null;
}

export interface CrmContactUpdateInput {
  accountId?: string;
  fullName?: string | null;
  title?: string | null;
  sourceTaskId?: string | null;
}

export interface CrmTimelineEventCreateInput {
  organizationId: string;
  accountId: string;
  contactId?: string | null;
  ownerUserId: string;
  eventType: string;
  title: string;
  content?: string | null;
  metadata?: unknown;
}

export interface CrmStore {
  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string): Promise<CrmAccountRecord | null>;
  createAccount(input: CrmAccountCreateInput): Promise<CrmAccountRecord>;
  updateAccount(id: string, input: CrmAccountUpdateInput): Promise<CrmAccountRecord | null>;
  findContactByEmailHash(
    organizationId: string,
    ownerUserId: string,
    emailHash: string
  ): Promise<CrmContactRecord | null>;
  createContact(input: CrmContactCreateInput): Promise<CrmContactRecord>;
  updateContact(id: string, input: CrmContactUpdateInput): Promise<CrmContactRecord | null>;
  listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    skip: number;
    take: number;
  }): Promise<{ records: CrmAccountRecord[]; total: number }>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
