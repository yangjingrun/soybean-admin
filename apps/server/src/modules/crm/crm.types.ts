export type OrganizationRole = 'member' | 'admin';

export const crmAccountStatuses = [
  'candidate',
  'missing_contact',
  'email_verification_pending',
  'manual_review_pending',
  'ready',
  'sequence_running',
  'replied_pending',
  'followed_up',
  'opportunity',
  'customer',
  'invalid',
  'paused',
  'blocked',
  'archived'
] as const;

export type CrmAccountStatus = (typeof crmAccountStatuses)[number];

export type CrmEmailStatus = 'unchecked' | 'valid' | 'invalid' | 'risky' | 'unreachable';

export const crmMailboxStatuses = ['active', 'paused', 'auth_expired'] as const;
export const crmMailboxWarmupStages = ['new', 'warming', 'ready'] as const;
export const crmProductLineStatuses = ['active', 'archived'] as const;

export type CrmMailboxProvider = 'gmail';
export type CrmMailboxStatus = (typeof crmMailboxStatuses)[number];
export type CrmMailboxWarmupStage = (typeof crmMailboxWarmupStages)[number];
export type CrmProductLineStatus = (typeof crmProductLineStatuses)[number];

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

export interface CrmMailboxRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  ownerUserName: string | null;
  provider: CrmMailboxProvider;
  emailAddress: string;
  emailHash: string;
  maskedEmail: string;
  status: CrmMailboxStatus;
  dailyLimit: number;
  hourlyLimit: number;
  warmupStage: CrmMailboxWarmupStage;
  watchExpiration: Date | null;
  lastHistoryId: string | null;
  authorizedAt: Date;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmProductLineRecord {
  id: string;
  organizationId: string;
  name: string;
  targetCustomerType: string | null;
  coreSellingPoints: string | null;
  moq: string | null;
  leadTime: string | null;
  paymentTerms: string | null;
  certifications: string | null;
  catalogUrl: string | null;
  websiteUrl: string | null;
  commonModelsText: string | null;
  status: CrmProductLineStatus;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmAccountDetailRecord {
  account: CrmAccountRecord;
  contacts: CrmContactRecord[];
  timelineEvents: CrmTimelineEventRecord[];
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

export interface CrmMailboxCreateInput {
  organizationId: string;
  ownerUserId: string;
  ownerUserName?: string | null;
  provider: CrmMailboxProvider;
  emailAddress: string;
  emailHash: string;
  maskedEmail: string;
  status: CrmMailboxStatus;
  dailyLimit: number;
  hourlyLimit: number;
  warmupStage: CrmMailboxWarmupStage;
  watchExpiration?: Date | null;
  lastHistoryId?: string | null;
  authorizedAt: Date;
  pausedAt?: Date | null;
}

export interface CrmMailboxUpdateInput {
  status?: CrmMailboxStatus;
  dailyLimit?: number;
  hourlyLimit?: number;
  warmupStage?: CrmMailboxWarmupStage;
  watchExpiration?: Date | null;
  lastHistoryId?: string | null;
  authorizedAt?: Date;
  pausedAt?: Date | null;
}

export interface CrmProductLineCreateInput {
  organizationId: string;
  name: string;
  targetCustomerType?: string | null;
  coreSellingPoints?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  paymentTerms?: string | null;
  certifications?: string | null;
  catalogUrl?: string | null;
  websiteUrl?: string | null;
  commonModelsText?: string | null;
  status: CrmProductLineStatus;
  createdById: string;
  createdByName?: string | null;
}

export interface CrmProductLineUpdateInput {
  name?: string;
  targetCustomerType?: string | null;
  coreSellingPoints?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  paymentTerms?: string | null;
  certifications?: string | null;
  catalogUrl?: string | null;
  websiteUrl?: string | null;
  commonModelsText?: string | null;
  status?: CrmProductLineStatus;
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
  findContactById(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmContactRecord | null>;
  updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus): Promise<CrmContactRecord | null>;
  listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmAccountStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmAccountRecord[]; total: number }>;
  getAccountDetail(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAccountDetailRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
  findMailboxByProviderAndEmailHash(
    provider: CrmMailboxProvider,
    emailHash: string
  ): Promise<CrmMailboxRecord | null>;
  createMailbox(input: CrmMailboxCreateInput): Promise<CrmMailboxRecord>;
  listMailboxes(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmMailboxStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmMailboxRecord[]; total: number }>;
  findMailboxById(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmMailboxRecord | null>;
  updateMailbox(id: string, input: CrmMailboxUpdateInput): Promise<CrmMailboxRecord | null>;
  listProductLines(args: {
    organizationId: string;
    keyword?: string;
    status?: CrmProductLineStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmProductLineRecord[]; total: number }>;
  findProductLineByName(organizationId: string, name: string): Promise<CrmProductLineRecord | null>;
  findProductLineById(args: { id: string; organizationId: string }): Promise<CrmProductLineRecord | null>;
  createProductLine(input: CrmProductLineCreateInput): Promise<CrmProductLineRecord>;
  updateProductLine(
    id: string,
    organizationId: string,
    input: CrmProductLineUpdateInput
  ): Promise<CrmProductLineRecord | null>;
}
