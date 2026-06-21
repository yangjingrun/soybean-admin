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
import { CrmPersonaProfileService } from './persona-profiles/crm-persona-profile.service';
import type { CrmPersonaProfileRepository } from './persona-profiles/crm-persona-profile.repository';

describe('CRM organization resource permissions', () => {
  it('rejects users without assigned read permissions when listing organization settings resources', async () => {
    await assert.rejects(
      () =>
        new CrmProductLineService(createProductLineRepository()).listProductLines(
          createContext({ roles: ['R_CUSTOM'] })
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        new CrmPersonaProfileService(createPersonaProfileRepository()).listPersonaProfiles(
          createContext({ roles: ['R_CUSTOM'] })
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        new CrmEmailTemplateGroupService(createEmailTemplateRepository()).listEmailTemplateGroups(
          createContext({ roles: ['R_CUSTOM'] })
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        new CrmSequencePolicyService(createSequencePolicyRepository()).listSequencePolicies(
          createContext({ roles: ['R_CUSTOM'] })
        ),
      ForbiddenException
    );
  });

  it('allows ordinary users to read email sequence resources without write permissions', async () => {
    await assert.rejects(
      () => new CrmProductLineService(createProductLineRepository()).listProductLines(createContext()),
      /listProductLines/
    );
    await assert.rejects(
      () => new CrmPersonaProfileService(createPersonaProfileRepository()).listPersonaProfiles(createContext()),
      /listPersonaProfiles/
    );
    await assert.rejects(
      () => new CrmEmailTemplateGroupService(createEmailTemplateRepository()).listEmailTemplateGroups(createContext()),
      /listEmailTemplateGroups/
    );
    await assert.rejects(
      () => new CrmSequencePolicyService(createSequencePolicyRepository()).listSequencePolicies(createContext()),
      /listSequencePolicies/
    );

    await assert.rejects(
      () =>
        new CrmProductLineService(createProductLineRepository()).createProductLine(
          { name: 'Bearings' },
          createContext()
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        new CrmSequencePolicyService(createSequencePolicyRepository()).createSequencePolicy(
          { name: 'Default' },
          createContext()
        ),
      ForbiddenException
    );
  });

  it('allows users with assigned read permissions to reach organization settings list repositories', async () => {
    await assert.rejects(
      () =>
        new CrmProductLineService(createProductLineRepository()).listProductLines(
          createContext({ buttons: ['crm:settings:assets:read'] })
        ),
      /listProductLines/
    );
    await assert.rejects(
      () =>
        new CrmPersonaProfileService(createPersonaProfileRepository()).listPersonaProfiles(
          createContext({ buttons: ['crm:settings:assets:read'] })
        ),
      /listPersonaProfiles/
    );
    await assert.rejects(
      () =>
        new CrmEmailTemplateGroupService(createEmailTemplateRepository()).listEmailTemplateGroups(
          createContext({ buttons: ['crm:settings:assets:read'] })
        ),
      /listEmailTemplateGroups/
    );
    await assert.rejects(
      () =>
        new CrmSequencePolicyService(createSequencePolicyRepository()).listSequencePolicies(
          createContext({ buttons: ['crm:settings:rules:read'] })
        ),
      /listSequencePolicies/
    );
  });

  it('rejects users without assigned permission when writing organization product lines', async () => {
    const service = new CrmProductLineService(createProductLineRepository());
    const context = createContext();

    await assert.rejects(() => service.createProductLine({ name: 'Bearings' }, context), ForbiddenException);
    await assert.rejects(() => service.updateProductLine('product-1', { name: 'Motors' }, context), ForbiddenException);
    await assert.rejects(() => service.archiveProductLine('product-1', context), ForbiddenException);
  });

  it('allows users with asset write permission to reach product line write repositories', async () => {
    const service = new CrmProductLineService(createProductLineRepository());
    const context = createContext({ buttons: ['crm:settings:assets:write'] });

    await assert.rejects(() => service.createProductLine({ name: 'Bearings' }, context), /findProductLineByName/);
    await assert.rejects(() => service.archiveProductLine('product-1', context), /findProductLineById/);
  });

  it('rejects users without assigned permission when writing organization email templates', async () => {
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

  it('allows users with asset write permission to reach email template write repositories', async () => {
    const service = new CrmEmailTemplateGroupService(createEmailTemplateRepository());
    const context = createContext({ buttons: ['crm:settings:assets:write'] });

    await assert.rejects(
      () => service.createEmailTemplateGroup({ name: 'Default', steps: createEmailTemplateSteps() }, context),
      /findEmailTemplateGroupByName/
    );
    await assert.rejects(() => service.setDefaultEmailTemplateGroup('template-1', context), /findEmailTemplateGroupById/);
  });

  it('rejects users without assigned permission when writing organization sequence policies', async () => {
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

  it('allows users with rules write permission to reach sequence policy write repositories', async () => {
    const service = new CrmSequencePolicyService(createSequencePolicyRepository());
    const context = createContext({ buttons: ['crm:settings:rules:write'] });

    await assert.rejects(() => service.createSequencePolicy({ name: 'Default' }, context), /createSequencePolicy/);
    await assert.rejects(() => service.setDefaultSequencePolicy('policy-1', context), /findSequencePolicyById/);
  });

  it('rejects users without assigned permission when reading or changing organization blacklist settings', async () => {
    const service = new CrmSuppressionService(createSuppressionRepository());
    const context = createContext();

    await assert.rejects(() => service.listBlacklistEntries(context), ForbiddenException);
    await assert.rejects(
      () => service.removeBlacklistEntry('blacklist-1', { reason: 'manual review' }, context),
      ForbiddenException
    );
  });

  it('allows users with safety permissions to reach blacklist repositories', async () => {
    const service = new CrmSuppressionService(createSuppressionRepository());

    await assert.rejects(
      () => service.listBlacklistEntries(createContext({ buttons: ['crm:settings:safety:read'] })),
      /listBlacklistEntries/
    );
    await assert.rejects(
      () =>
        service.removeBlacklistEntry(
          'blacklist-1',
          { reason: 'manual review' },
          createContext({ buttons: ['crm:settings:safety:write'] })
        ),
      /deleteBlacklistEntry/
    );
  });
});

function createContext(input: Partial<CrmUserContext> = {}): CrmUserContext {
  return {
    userId: input.userId ?? 'user-1',
    userName: input.userName ?? 'Alice',
    roles: input.roles ?? ['R_USER'],
    buttons: input.buttons ?? [],
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

function createPersonaProfileRepository(): CrmPersonaProfileRepository {
  return {
    createPersonaProfile: async () => unexpectedRepositoryCall('createPersonaProfile'),
    findPersonaProfileById: async () => unexpectedRepositoryCall('findPersonaProfileById'),
    findPersonaProfileByName: async () => unexpectedRepositoryCall('findPersonaProfileByName'),
    listActivePersonaProfiles: async () => unexpectedRepositoryCall('listActivePersonaProfiles'),
    listPersonaProfiles: async () => unexpectedRepositoryCall('listPersonaProfiles'),
    setDefaultPersonaProfile: async () => unexpectedRepositoryCall('setDefaultPersonaProfile'),
    updatePersonaProfile: async () => unexpectedRepositoryCall('updatePersonaProfile')
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
