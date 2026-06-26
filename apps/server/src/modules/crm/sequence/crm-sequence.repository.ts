import type {
  CrmSequenceDraftBundleCreateInput,
  CrmSequenceDraftBundleRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceReviewRecord,
  CrmSequenceReviewTodoType,
  CrmMessageStatus
} from '../crm.types';

export interface CrmSequenceRepository {
  findActiveEnrollmentByContact(args: {
    organizationId: string;
    ownerUserId: string;
    contactId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }): Promise<CrmSequenceEnrollmentRecord | null>;
  findActiveEnrollmentByAccount(args: {
    organizationId: string;
    ownerUserId: string;
    accountId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }): Promise<CrmSequenceEnrollmentRecord | null>;
  createSequenceDraftBundle(input: CrmSequenceDraftBundleCreateInput): Promise<CrmSequenceDraftBundleRecord>;
  listMailboxSendScheduleTimes(args: { organizationId: string; mailboxId: string }): Promise<Date[]>;
  listSequenceReviewItems(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    currentStep?: number;
    status?: CrmSequenceEnrollmentStatus;
    todoType?: CrmSequenceReviewTodoType;
    messageStatus?: CrmMessageStatus;
    dateScope?: 'today';
    createdAtScope?: 'today' | 'yesterday' | 'last_3_days' | 'last_7_days' | 'last_30_days';
    now?: Date;
    skip: number;
    take: number;
  }): Promise<{ records: CrmSequenceReviewRecord[]; total: number }>;
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
}
