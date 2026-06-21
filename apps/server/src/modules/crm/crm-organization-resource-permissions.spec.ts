import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { CrmUserContext } from './crm.types';
import { CrmProductLineService } from './product-lines/crm-product-line.service';
import type { CrmProductLineRepository } from './product-lines/crm-product-line.repository';
import { CrmEmailTemplateGroupService } from './template-groups/crm-email-template-group.service';
import type { CrmEmailTemplateGroupRepository } from './template-groups/crm-email-template-group.repository';
import { CrmSequencePolicyService } from './sequence-policies/crm-sequence-policy.service';
import type { CrmSequencePolicyRepository } from './sequence-policies/crm-sequence-policy.repository';
import { CrmSuppressionService } from './suppression/crm-suppression.service';
import type { CrmSuppressionRepository } from './suppression/crm-suppression.repository';

describe('CRM organization resource permissions', () => {
  it('rejects ordinary members when writing organization product lines', async () => {
    const service = new CrmProductLineService(createProductLineRepository());
    const context = createContext();

    await assert.rejects(() => service.createProductLine({ name: 'Bearings' }, context), ForbiddenException);
    await assert.rejects(() => service.updateProductLine('product-1', { name: 'Motors' }, context), ForbiddenException);
    await assert.rejects(() => service.archiveProductLine('product-1', context), ForbiddenException);
  });

  it('rejects ordinary members when writing organization email templates', async () => {
    const service = new CrmEmailTemplateGroupService(createEmailTemplateRepository());
    const context = createContext();

    await assert.rejects(
      () => service.createEmailTemplateGroup({ name: 'Default', steps: createEmailTemplateSteps() }, context),
      ForbiddenException
    );
    await assert.rejects(
      () => service.updateEmailTemplateGroup('template-1', { name: 'Updated' }, context),
      ForbiddenException
    );
    await assert.rejects(() => service.archiveEmailTemplateGroup('template-1', context), ForbiddenException);
    await assert.rejects(() => service.setDefaultEmailTemplateGroup('template-1', context), ForbiddenException);
  });

  it('rejects ordinary members when writing organization sequence policies', async () => {
    const service = new CrmSequencePolicyService(createSequencePolicyRepository());
    const context = createContext();

    await assert.rejects(() => service.createSequencePolicy({ name: 'Default' }, context), ForbiddenException);
    await assert.rejects(
      () => service.updateSequencePolicy('policy-1', { name: 'Updated' }, context),
      ForbiddenException
    );
    await assert.rejects(() => service.archiveSequencePolicy('policy-1', context), ForbiddenException);
    await assert.rejects(() => service.setDefaultSequencePolicy('policy-1', context), ForbiddenException);
  });

  it('rejects ordinary members when reading or changing organization blacklist settings', async () => {
    const service = new CrmSuppressionService(createSuppressionRepository());
    const context = createContext();

    await assert.rejects(() => service.listBlacklistEntries(context), ForbiddenException);
    await assert.rejects(
      () => service.removeBlacklistEntry('blacklist-1', { reason: 'manual review' }, context),
      ForbiddenException
    );
  });
});

function createContext(input: Partial<CrmUserContext> = {}): CrmUserContext {
  return {
    userId: input.userId ?? 'user-1',
    userName: input.userName ?? 'Alice',
    roles: input.roles ?? ['R_USER'],
    organizationId: input.organizationId ?? 'org-1',
    organizationRole: input.organizationRole ?? 'member'
  };
}

function createEmailTemplateSteps() {
  return Array.from({ length: 5 }, (_, index) => ({
    bodyTemplate: `Body ${index + 1}`,
    delayDays: index === 0 ? 0 : index * 3,
    name: `Step ${index + 1}`,
    stepIndex: index + 1,
    subjectTemplate: index === 1 ? '' : `Subject ${index + 1}`,
    threadMode: index === 1 ? ('same_thread' as const) : ('new_subject' as const)
  }));
}

function createProductLineRepository(): CrmProductLineRepository {
  return {
    createProductLine: async () => unexpectedRepositoryCall('createProductLine'),
    createProductLineAiPromptVersion: async () => unexpectedRepositoryCall('createProductLineAiPromptVersion'),
    findProductLineById: async () => unexpectedRepositoryCall('findProductLineById'),
    findProductLineByName: async () => unexpectedRepositoryCall('findProductLineByName'),
    listProductLineAiPromptVersions: async () => unexpectedRepositoryCall('listProductLineAiPromptVersions'),
    listProductLines: async () => unexpectedRepositoryCall('listProductLines'),
    restoreProductLineAiPromptVersion: async () => unexpectedRepositoryCall('restoreProductLineAiPromptVersion'),
    updateProductLine: async () => unexpectedRepositoryCall('updateProductLine')
  };
}

function createEmailTemplateRepository(): CrmEmailTemplateGroupRepository {
  return {
    createEmailTemplateGroup: async () => unexpectedRepositoryCall('createEmailTemplateGroup'),
    findDefaultEmailTemplateGroup: async () => unexpectedRepositoryCall('findDefaultEmailTemplateGroup'),
    findEmailTemplateGroupById: async () => unexpectedRepositoryCall('findEmailTemplateGroupById'),
    findEmailTemplateGroupByName: async () => unexpectedRepositoryCall('findEmailTemplateGroupByName'),
    getGlobalConfig: async () => unexpectedRepositoryCall('getGlobalConfig'),
    listActivePersonaProfiles: async () => unexpectedRepositoryCall('listActivePersonaProfiles'),
    listEmailTemplateGroups: async () => unexpectedRepositoryCall('listEmailTemplateGroups'),
    setDefaultEmailTemplateGroup: async () => unexpectedRepositoryCall('setDefaultEmailTemplateGroup'),
    updateEmailTemplateGroup: async () => unexpectedRepositoryCall('updateEmailTemplateGroup')
  };
}

function createSequencePolicyRepository(): CrmSequencePolicyRepository {
  return {
    createSequencePolicy: async () => unexpectedRepositoryCall('createSequencePolicy'),
    findDefaultSequencePolicy: async () => unexpectedRepositoryCall('findDefaultSequencePolicy'),
    findSequencePolicyById: async () => unexpectedRepositoryCall('findSequencePolicyById'),
    findSequencePolicyByName: async () => unexpectedRepositoryCall('findSequencePolicyByName'),
    listSequencePolicies: async () => unexpectedRepositoryCall('listSequencePolicies'),
    setDefaultSequencePolicy: async () => unexpectedRepositoryCall('setDefaultSequencePolicy'),
    updateSequencePolicy: async () => unexpectedRepositoryCall('updateSequencePolicy')
  };
}

function createSuppressionRepository(): CrmSuppressionRepository {
  return {
    deleteBlacklistEntry: async () => unexpectedRepositoryCall('deleteBlacklistEntry'),
    findBlacklistEntry: async () => unexpectedRepositoryCall('findBlacklistEntry'),
    listBlacklistEntries: async () => unexpectedRepositoryCall('listBlacklistEntries'),
    listBlacklistEntriesByEmailHashes: async () => unexpectedRepositoryCall('listBlacklistEntriesByEmailHashes'),
    upsertBlacklistEntry: async () => unexpectedRepositoryCall('upsertBlacklistEntry')
  };
}

function unexpectedRepositoryCall(method: string): never {
  throw new Error(`${method} should not be called before permission is checked`);
}
