import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type {
  CrmAccountRecord,
  CrmBlacklistRecord,
  CrmContactRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequencePolicyRecord,
  CrmUserContext
} from '../crm.types';
import { CrmSequenceEligibilityService } from './crm-sequence-eligibility.service';
import type { CrmSequenceRepository } from './crm-sequence.repository';

describe('CrmSequenceEligibilityService', () => {
  it('rejects non-owner account/contact writes before reading sequence policy state', async () => {
    const sequenceRepository = createSequenceRepository();
    const service = createService({
      sequenceRepository
    });

    await assert.rejects(
      () =>
        service.assertCanCreateSequenceReview({
          account: createAccount({ ownerUserId: 'other-user' }),
          contact: createContact(),
          policy: null,
          context: createContext()
        }),
      BadRequestException
    );

    assert.equal(sequenceRepository.contactChecks.length, 0);
    assert.equal(sequenceRepository.accountChecks.length, 0);
  });

  it('rejects organization-blacklisted contacts before active sequence checks', async () => {
    const sequenceRepository = createSequenceRepository();
    const service = createService({
      sequenceRepository,
      blacklistEntry: createBlacklistEntry()
    });

    await assert.rejects(
      () =>
        service.assertCanCreateSequenceReview({
          account: createAccount(),
          contact: createContact(),
          policy: null,
          context: createContext()
        }),
      /组织黑名单/
    );

    assert.equal(sequenceRepository.contactChecks.length, 0);
    assert.equal(sequenceRepository.accountChecks.length, 0);
  });

  it('blocks first draft creation when the contact has any existing sequence history', async () => {
    const sequenceRepository = createSequenceRepository();
    const service = createService({
      sequenceRepository
    });

    await service.assertCanCreateSequenceReview({
      account: createAccount(),
      contact: createContact(),
      policy: null,
      context: createContext()
    });

    assert.deepEqual(sequenceRepository.contactChecks[0], {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      contactId: 'contact-1',
      statuses: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused', 'stopped', 'replied', 'archived']
    });
    assert.deepEqual(sequenceRepository.accountChecks[0], {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      statuses: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused']
    });
  });

  it('rejects stopped or replied sequence history before generating another first draft', async () => {
    const service = createService({
      sequenceRepository: createSequenceRepository({
        existingContactEnrollment: createEnrollment({ status: 'stopped' })
      })
    });

    await assert.rejects(
      () =>
        service.assertCanCreateSequenceReview({
          account: createAccount(),
          contact: createContact(),
          policy: null,
          context: createContext()
        }),
      /该联系人已生成过开发信/
    );
  });

  it('allows multiple contacts in the same company only when policy explicitly permits it', async () => {
    const existingEnrollment = createEnrollment({ contactId: 'other-contact' });
    const service = createService({
      sequenceRepository: createSequenceRepository({ existingAccountEnrollment: existingEnrollment })
    });

    await assert.rejects(
      () =>
        service.assertCanCreateSequenceReview({
          account: createAccount(),
          contact: createContact(),
          policy: null,
          context: createContext()
        }),
      /同公司已有进行中的开发信序列/
    );

    await service.assertCanCreateSequenceReview({
      account: createAccount(),
      contact: createContact(),
      policy: createSequencePolicy({ sameCompanyContactStrategy: 'allow_multiple_contacts' }),
      context: createContext()
    });
  });
});

function createService(input: {
  sequenceRepository?: FakeSequenceRepository;
  blacklistEntry?: CrmBlacklistRecord | null;
} = {}) {
  return new CrmSequenceEligibilityService(
    input.sequenceRepository ?? createSequenceRepository(),
    {
      async findBlacklistEntry() {
        return input.blacklistEntry ?? null;
      }
    } as never
  );
}

type FakeSequenceRepository = CrmSequenceRepository & {
  contactChecks: Array<Parameters<CrmSequenceRepository['findActiveEnrollmentByContact']>[0]>;
  accountChecks: Array<Parameters<CrmSequenceRepository['findActiveEnrollmentByAccount']>[0]>;
};

function createSequenceRepository(input: {
  existingContactEnrollment?: CrmSequenceEnrollmentRecord | null;
  existingAccountEnrollment?: CrmSequenceEnrollmentRecord | null;
} = {}): FakeSequenceRepository {
  return {
    contactChecks: [],
    accountChecks: [],
    async findActiveEnrollmentByContact(args) {
      this.contactChecks.push(args);
      const enrollment = input.existingContactEnrollment ?? null;

      return enrollment && args.statuses.includes(enrollment.status) ? enrollment : null;
    },
    async findActiveEnrollmentByAccount(args) {
      this.accountChecks.push(args);
      const enrollment = input.existingAccountEnrollment ?? null;

      return enrollment && args.statuses.includes(enrollment.status) ? enrollment : null;
    },
    async createSequenceDraftBundle() {
      throw new Error('createSequenceDraftBundle should not be called');
    },
    async listSequenceReviewItems() {
      throw new Error('listSequenceReviewItems should not be called');
    },
    async getSequenceReviewItem() {
      throw new Error('getSequenceReviewItem should not be called');
    }
  };
}

function createContext(): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member'
  };
}

function createAccount(overrides: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'Acme',
    normalizedName: 'acme',
    websiteUrl: 'https://acme.example',
    domain: 'acme.example',
    country: null,
    customerType: null,
    status: 'candidate',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createContact(overrides: Partial<CrmContactRecord> = {}): CrmContactRecord {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Alice Buyer',
    title: 'Purchasing Manager',
    email: 'alice@example.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid',
    sourceTaskId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createEnrollment(overrides: Partial<CrmSequenceEnrollmentRecord> = {}): CrmSequenceEnrollmentRecord {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: null,
    mailboxId: null,
    policyId: null,
    name: 'Acme - Alice Buyer',
    status: 'sequence_running',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createBlacklistEntry(overrides: Partial<CrmBlacklistRecord> = {}): CrmBlacklistRecord {
  return {
    id: 'blacklist-1',
    organizationId: 'org-1',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    reason: 'unsubscribe',
    sourceAccountId: null,
    sourceContactId: null,
    sourceMessageId: null,
    createdById: null,
    createdByName: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}

function createSequencePolicy(overrides: Partial<CrmSequencePolicyRecord> = {}): CrmSequencePolicyRecord {
  return {
    id: 'policy-1',
    organizationId: 'org-1',
    name: 'Default',
    description: null,
    status: 'active',
    isDefault: true,
    steps: [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
      { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
      { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
      { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
      { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
    ],
    linkPolicy: 'preserve_template_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides
  };
}
