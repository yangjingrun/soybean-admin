import { Prisma } from '../../../generated/prisma/client';
import type { CrmEmailTemplateGroupModel } from '../../../generated/prisma/models/CrmEmailTemplateGroup';
import type { CrmEmailTemplateStepModel } from '../../../generated/prisma/models/CrmEmailTemplateStep';
import { PrismaService } from '../../database/prisma.service';
import {
  createDefaultAiDraftQueueConfig,
  createDefaultGlobalConfig,
  normalizePositiveConfigInteger,
  toAiDraftQueueConfigRecord,
  toEmailTemplateGroupListWhere,
  toEmailTemplateGroupRecord,
  toEmailTemplateStepCreateManyInput,
  toGlobalConfigRecord,
  toNullableJsonInput,
  toOrganizationConfigRecord,
  toPersonaProfileCreateInput,
  toPersonaProfileListWhere,
  toPersonaProfileRecord,
  toPersonaProfileUpdateInput,
  toProductLineAiPromptVersionJson,
  toProductLineAiPromptVersionRecord,
  toProductLineAiWritingConfig,
  toProductLineIdentityWhere,
  toProductLineListWhere,
  toProductLineRecord,
  toSendPreferenceRecord,
  toSequencePolicyCreateInput,
  toSequencePolicyListWhere,
  toSequencePolicyRecord,
  toSequencePolicyUpdateInput
} from './prisma-crm-store.helpers';
import {
  defaultCrmAiDraftItemConcurrency,
  defaultCrmAiDraftMaxAttempts,
  defaultCrmAiDraftRetryBackoffSeconds,
  maxCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftMaxAttempts
} from '../crm-ai-draft-task-state';
import {
  crmGlobalConfigKey,
  normalizeEmailVerificationCooldownDays,
  normalizeOwnerConcurrentSendLimit,
  normalizeOwnerDailySendLimitMax,
  serializeFollowUpDelayDays
} from '../crm-global-config';
import type {
  CrmAiDraftQueueConfigInput,
  CrmEmailTemplateGroupCreateInput,
  CrmEmailTemplateGroupListInput,
  CrmEmailTemplateGroupUpdateInput,
  CrmGlobalConfigInput,
  CrmOrganizationConfigInput,
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileUpdateInput,
  CrmProductLineAiPromptVersionCreateInput,
  CrmProductLineAiPromptVersionRestoreInput,
  CrmProductLineCreateInput,
  CrmProductLineStatus,
  CrmProductLineUpdateInput,
  CrmSendPreferenceInput,
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyUpdateInput
} from '../crm.types';

type CrmEmailTemplateGroupModelWithSteps = CrmEmailTemplateGroupModel & {
  steps: CrmEmailTemplateStepModel[];
};

const emailTemplateGroupInclude = {
  steps: {
    orderBy: { stepIndex: 'asc' as const }
  }
};
const crmAiDraftQueueConfigKey = 'crm-ai-draft';

export class PrismaCrmSettingsStore {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalConfig() {
    const record = await this.prisma.crmGlobalConfig.findUnique({
      where: { configKey: crmGlobalConfigKey }
    });

    return record ? toGlobalConfigRecord(record) : createDefaultGlobalConfig();
  }

  async saveGlobalConfig(input: CrmGlobalConfigInput) {
    const emailVerificationCooldownDays = normalizeEmailVerificationCooldownDays(input.emailVerificationCooldownDays);
    const ownerConcurrentSendLimit = normalizeOwnerConcurrentSendLimit(input.ownerConcurrentSendLimit);
    const ownerDailySendLimitMax = normalizeOwnerDailySendLimitMax(input.ownerDailySendLimitMax);
    const followUpDelayDaysText = serializeFollowUpDelayDays(input.followUpDelayDays);
    const record = await this.prisma.crmGlobalConfig.upsert({
      where: { configKey: crmGlobalConfigKey },
      create: {
        configKey: crmGlobalConfigKey,
        emailVerificationCooldownDays,
        ownerConcurrentSendLimit,
        ownerDailySendLimitMax,
        followUpDelayDaysText,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        emailVerificationCooldownDays,
        ownerConcurrentSendLimit,
        ownerDailySendLimitMax,
        followUpDelayDaysText,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toGlobalConfigRecord(record);
  }

  async getAiDraftQueueConfig() {
    const record = await this.prisma.crmAiDraftQueueConfig.findUnique({
      where: { configKey: crmAiDraftQueueConfigKey }
    });

    return record ? toAiDraftQueueConfigRecord(record) : createDefaultAiDraftQueueConfig();
  }

  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput) {
    const maxItemConcurrency = normalizeCrmAiDraftItemConcurrency(
      input.maxItemConcurrency ?? maxCrmAiDraftItemConcurrency,
      maxCrmAiDraftItemConcurrency
    );
    const itemConcurrency = normalizeCrmAiDraftItemConcurrency(
      input.itemConcurrency ?? defaultCrmAiDraftItemConcurrency,
      maxItemConcurrency
    );
    const maxAttempts = normalizeCrmAiDraftMaxAttempts(input.maxAttempts ?? defaultCrmAiDraftMaxAttempts);
    const record = await this.prisma.crmAiDraftQueueConfig.upsert({
      where: { configKey: crmAiDraftQueueConfigKey },
      create: {
        configKey: crmAiDraftQueueConfigKey,
        itemConcurrency,
        maxItemConcurrency,
        maxActiveTasksPerUser: normalizePositiveConfigInteger(input.maxActiveTasksPerUser, 1),
        maxActiveTasksPerOrg: normalizePositiveConfigInteger(input.maxActiveTasksPerOrg, 2),
        maxAttempts,
        retryBackoffSeconds: toNullableJsonInput(
          input.retryBackoffSeconds ?? [...defaultCrmAiDraftRetryBackoffSeconds]
        ),
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      },
      update: {
        itemConcurrency,
        maxItemConcurrency,
        maxActiveTasksPerUser: normalizePositiveConfigInteger(input.maxActiveTasksPerUser, 1),
        maxActiveTasksPerOrg: normalizePositiveConfigInteger(input.maxActiveTasksPerOrg, 2),
        maxAttempts,
        retryBackoffSeconds: toNullableJsonInput(
          input.retryBackoffSeconds ?? [...defaultCrmAiDraftRetryBackoffSeconds]
        ),
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      }
    });

    return toAiDraftQueueConfigRecord(record);
  }

  async getSendPreference(args: { organizationId: string; ownerUserId: string }) {
    const record = await this.prisma.crmUserSendPreference.findUnique({
      where: {
        organizationId_ownerUserId: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId
        }
      }
    });

    return record ? toSendPreferenceRecord(record) : null;
  }

  async saveSendPreference(input: CrmSendPreferenceInput) {
    const record = await this.prisma.crmUserSendPreference.upsert({
      where: {
        organizationId_ownerUserId: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        }
      },
      create: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        ownerUserName: input.ownerUserName,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toSendPreferenceRecord(record);
  }

  async getOrganizationConfig(organizationId: string) {
    const record = await this.prisma.crmOrganizationConfig.findUnique({
      where: { organizationId }
    });

    return record ? toOrganizationConfigRecord(record) : null;
  }

  async saveOrganizationConfig(input: CrmOrganizationConfigInput) {
    const record = await this.prisma.crmOrganizationConfig.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      },
      update: {
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      }
    });

    return toOrganizationConfigRecord(record);
  }

  async listProductLines(args: {
    organizationId: string;
    keyword?: string;
    status?: CrmProductLineStatus;
    skip: number;
    take: number;
  }) {
    const where = toProductLineListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmProductLine.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmProductLine.count({ where })
    ]);

    return {
      records: records.map(toProductLineRecord),
      total
    };
  }

  findProductLineByName(organizationId: string, name: string) {
    return this.prisma.crmProductLine
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toProductLineRecord(record) : null));
  }

  findProductLineById(args: { id: string; organizationId: string }) {
    return this.prisma.crmProductLine
      .findFirst({
        where: toProductLineIdentityWhere(args)
      })
      .then(record => (record ? toProductLineRecord(record) : null));
  }

  async createProductLine(input: CrmProductLineCreateInput) {
    const record = await this.prisma.crmProductLine.create({
      data: input as Prisma.CrmProductLineUncheckedCreateInput
    });

    return toProductLineRecord(record);
  }

  async updateProductLine(id: string, organizationId: string, input: CrmProductLineUpdateInput) {
    const data = (
      input.aiWritingConfig === null ? { ...input, aiWritingConfig: Prisma.JsonNull } : input
    ) as Prisma.CrmProductLineUpdateManyMutationInput;
    const records = await this.prisma.crmProductLine.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data,
      limit: 1
    });

    return records[0] ? toProductLineRecord(records[0]) : null;
  }

  async createProductLineAiPromptVersion(input: CrmProductLineAiPromptVersionCreateInput) {
    return this.prisma.$transaction(async tx => {
      const latestVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          productLineId: input.productLineId
        },
        orderBy: { version: 'desc' }
      });
      const record = await tx.crmProductLineAiPromptVersion.create({
        data: {
          organizationId: input.organizationId,
          productLineId: input.productLineId,
          version: (latestVersion?.version ?? 0) + 1,
          aiWritingConfig: toProductLineAiPromptVersionJson(input.aiWritingConfig),
          editorId: input.editorId,
          editorName: input.editorName ?? null,
          changeSummary: input.changeSummary ?? null
        }
      });

      return toProductLineAiPromptVersionRecord(record);
    });
  }

  async listProductLineAiPromptVersions(args: { organizationId: string; productLineId: string }) {
    const records = await this.prisma.crmProductLineAiPromptVersion.findMany({
      where: {
        organizationId: args.organizationId,
        productLineId: args.productLineId
      },
      orderBy: { version: 'desc' }
    });

    return records.map(toProductLineAiPromptVersionRecord);
  }

  async restoreProductLineAiPromptVersion(input: CrmProductLineAiPromptVersionRestoreInput) {
    return this.prisma.$transaction(async tx => {
      const restoredVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          id: input.versionId,
          organizationId: input.organizationId,
          productLineId: input.productLineId
        }
      });

      if (!restoredVersion) {
        return null;
      }

      const productLines = await tx.crmProductLine.updateManyAndReturn({
        where: {
          id: input.productLineId,
          organizationId: input.organizationId
        },
        data: {
          aiWritingConfig: toProductLineAiPromptVersionJson(
            toProductLineAiWritingConfig(restoredVersion.aiWritingConfig)
          )
        },
        limit: 1
      });
      const productLine = productLines[0];

      if (!productLine) {
        return null;
      }

      const latestVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          productLineId: input.productLineId
        },
        orderBy: { version: 'desc' }
      });
      const currentVersion = await tx.crmProductLineAiPromptVersion.create({
        data: {
          organizationId: input.organizationId,
          productLineId: input.productLineId,
          version: (latestVersion?.version ?? restoredVersion.version) + 1,
          aiWritingConfig: toProductLineAiPromptVersionJson(
            toProductLineAiWritingConfig(restoredVersion.aiWritingConfig)
          ),
          editorId: input.editorId,
          editorName: input.editorName ?? null,
          changeSummary: input.changeSummary ?? `恢复版本 ${restoredVersion.version}`
        }
      });

      return {
        productLine: toProductLineRecord(productLine),
        restoredVersion: toProductLineAiPromptVersionRecord(restoredVersion),
        currentVersion: toProductLineAiPromptVersionRecord(currentVersion)
      };
    });
  }

  async listPersonaProfiles(input: CrmPersonaProfileListInput) {
    const where = toPersonaProfileListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmPersonaProfile.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.crmPersonaProfile.count({ where })
    ]);

    return {
      records: records.map(toPersonaProfileRecord),
      total
    };
  }

  listActivePersonaProfiles(organizationId: string) {
    return this.prisma.crmPersonaProfile
      .findMany({
        where: {
          organizationId,
          status: 'active'
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      })
      .then(records => records.map(toPersonaProfileRecord));
  }

  findPersonaProfileByName(organizationId: string, name: string) {
    return this.prisma.crmPersonaProfile
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toPersonaProfileRecord(record) : null));
  }

  findPersonaProfileById(args: { id: string; organizationId: string }) {
    return this.prisma.crmPersonaProfile
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        }
      })
      .then(record => (record ? toPersonaProfileRecord(record) : null));
  }

  async createPersonaProfile(input: CrmPersonaProfileCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmPersonaProfile.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const record = await tx.crmPersonaProfile.create({
        data: toPersonaProfileCreateInput(input)
      });

      return toPersonaProfileRecord(record);
    });
  }

  async updatePersonaProfile(id: string, organizationId: string, input: CrmPersonaProfileUpdateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmPersonaProfile.updateMany({
          where: {
            organizationId,
            id: { not: id },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const records = await tx.crmPersonaProfile.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: toPersonaProfileUpdateInput(input),
        limit: 1
      });

      return records[0] ? toPersonaProfileRecord(records[0]) : null;
    });
  }

  async setDefaultPersonaProfile(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmPersonaProfile.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmPersonaProfile.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      return toPersonaProfileRecord(records[0]);
    });
  }

  async listEmailTemplateGroups(input: CrmEmailTemplateGroupListInput) {
    const where = toEmailTemplateGroupListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmEmailTemplateGroup.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { updatedAt: 'desc' },
        include: emailTemplateGroupInclude
      }),
      this.prisma.crmEmailTemplateGroup.count({ where })
    ]);

    return {
      records: records.map(toEmailTemplateGroupRecord),
      total
    };
  }

  findEmailTemplateGroupByName(organizationId: string, name: string) {
    return this.prisma.crmEmailTemplateGroup
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        },
        include: emailTemplateGroupInclude
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  findEmailTemplateGroupById(args: { id: string; organizationId: string }) {
    return this.prisma.crmEmailTemplateGroup
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        },
        include: emailTemplateGroupInclude
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  findDefaultEmailTemplateGroup(organizationId: string) {
    return this.prisma.crmEmailTemplateGroup
      .findFirst({
        where: {
          organizationId,
          status: 'active',
          isDefault: true
        },
        include: emailTemplateGroupInclude,
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  async createEmailTemplateGroup(input: CrmEmailTemplateGroupCreateInput) {
    return this.prisma.$transaction(async tx => {
      const group = await tx.crmEmailTemplateGroup.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          language: input.language,
          description: input.description ?? null,
          status: input.status,
          isDefault: input.isDefault,
          createdById: input.createdById,
          createdByName: input.createdByName ?? null
        }
      });

      await tx.crmEmailTemplateStep.createMany({
        data: toEmailTemplateStepCreateManyInput(input.organizationId, group.id, input.steps)
      });

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id: group.id },
        include: emailTemplateGroupInclude
      });

      return toEmailTemplateGroupRecord(record as CrmEmailTemplateGroupModelWithSteps);
    });
  }

  async updateEmailTemplateGroup(id: string, organizationId: string, input: CrmEmailTemplateGroupUpdateInput) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmEmailTemplateGroup.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: {
          name: input.name,
          language: input.language,
          description: input.description,
          status: input.status,
          isDefault: input.isDefault
        },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      if (input.steps) {
        await tx.crmEmailTemplateStep.deleteMany({
          where: {
            organizationId,
            templateGroupId: id
          }
        });
        await tx.crmEmailTemplateStep.createMany({
          data: toEmailTemplateStepCreateManyInput(organizationId, id, input.steps)
        });
      }

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id },
        include: emailTemplateGroupInclude
      });

      return record ? toEmailTemplateGroupRecord(record) : null;
    });
  }

  async setDefaultEmailTemplateGroup(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmEmailTemplateGroup.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmEmailTemplateGroup.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id },
        include: emailTemplateGroupInclude
      });

      return record ? toEmailTemplateGroupRecord(record) : null;
    });
  }

  async listSequencePolicies(input: CrmSequencePolicyListInput) {
    const where = toSequencePolicyListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmSequencePolicy.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.crmSequencePolicy.count({ where })
    ]);

    return {
      records: records.map(toSequencePolicyRecord),
      total
    };
  }

  findSequencePolicyByName(organizationId: string, name: string) {
    return this.prisma.crmSequencePolicy
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  findSequencePolicyById(args: { id: string; organizationId: string }) {
    return this.prisma.crmSequencePolicy
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  findDefaultSequencePolicy(organizationId: string) {
    return this.prisma.crmSequencePolicy
      .findFirst({
        where: {
          organizationId,
          status: 'active',
          isDefault: true
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  async createSequencePolicy(input: CrmSequencePolicyCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmSequencePolicy.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const record = await tx.crmSequencePolicy.create({
        data: toSequencePolicyCreateInput(input)
      });

      return toSequencePolicyRecord(record);
    });
  }

  async updateSequencePolicy(id: string, organizationId: string, input: CrmSequencePolicyUpdateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmSequencePolicy.updateMany({
          where: {
            organizationId,
            id: { not: id },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const records = await tx.crmSequencePolicy.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: toSequencePolicyUpdateInput(input),
        limit: 1
      });

      return records[0] ? toSequencePolicyRecord(records[0]) : null;
    });
  }

  async setDefaultSequencePolicy(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmSequencePolicy.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmSequencePolicy.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      return toSequencePolicyRecord(records[0]);
    });
  }
}
