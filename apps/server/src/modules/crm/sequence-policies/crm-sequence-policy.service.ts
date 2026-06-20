import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import { normalizeSequencePolicyStatus } from '../crm-sequence-policy';
import type { CrmSequencePolicyRecord, CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { isPrismaUniqueConflict } from '../store/prisma-error.helpers';
import { CRM_SEQUENCE_POLICY_REPOSITORY, type CrmSequencePolicyRepository } from './crm-sequence-policy.repository';
import {
  normalizeSequencePolicyCreateInput,
  normalizeSequencePolicyUpdateInput,
  toSequencePolicyView,
  type SequencePolicyWriteInput
} from './crm-sequence-policy-rules';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

@Injectable()
export class CrmSequencePolicyService {
  constructor(
    @Inject(CRM_SEQUENCE_POLICY_REPOSITORY)
    private readonly sequencePolicyRepository: CrmSequencePolicyRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Lists organization sequence policies for sequence creation and settings. */
  async listSequencePolicies(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: unknown;
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const status = query.status ? normalizeSequencePolicyStatus(query.status) : undefined;
    const result = await this.sequencePolicyRepository.listSequencePolicies({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(status ? { status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toSequencePolicyView)
    });
  }

  /** Creates one organization sequence policy. */
  async createSequencePolicy(input: SequencePolicyWriteInput, context: CrmUserContext) {
    const data = normalizeSequencePolicyCreateInput(input, context);
    const policy = await this.runSequencePolicyWrite(() => this.sequencePolicyRepository.createSequencePolicy(data));

    await this.recordSequencePolicyLog(
      'sequence-policy-create',
      'CRM 序列策略新建',
      context,
      policy,
      null,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Updates one organization sequence policy. */
  async updateSequencePolicy(id: string, input: SequencePolicyWriteInput, context: CrmUserContext) {
    const currentPolicy = await this.requireScopedSequencePolicy(id, context);
    const data = normalizeSequencePolicyUpdateInput(input);
    const nextStatus = data.status ?? currentPolicy.status;

    if (data.isDefault && nextStatus !== 'active') {
      throw new BadRequestException('只能将启用策略设为默认');
    }

    if (data.status === 'archived') {
      data.isDefault = false;
    }

    const policy = await this.runSequencePolicyWrite(() =>
      this.sequencePolicyRepository.updateSequencePolicy(currentPolicy.id, context.organizationId, data)
    );

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    await this.recordSequencePolicyLog(
      'sequence-policy-update',
      'CRM 序列策略更新',
      context,
      policy,
      currentPolicy.status,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Archives one sequence policy instead of deleting it. */
  async archiveSequencePolicy(id: string, context: CrmUserContext) {
    const currentPolicy = await this.requireScopedSequencePolicy(id, context);
    const policy = await this.sequencePolicyRepository.updateSequencePolicy(
      currentPolicy.id,
      context.organizationId,
      {
        status: 'archived',
        isDefault: false
      }
    );

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    await this.recordSequencePolicyLog(
      'sequence-policy-archive',
      'CRM 序列策略归档',
      context,
      policy,
      currentPolicy.status,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Marks one active organization sequence policy as default. */
  async setDefaultSequencePolicy(id: string, context: CrmUserContext) {
    const currentPolicy = await this.requireScopedSequencePolicy(id, context);

    if (currentPolicy.status !== 'active') {
      throw new BadRequestException('只能将启用策略设为默认');
    }

    const policy = await this.sequencePolicyRepository.setDefaultSequencePolicy(
      currentPolicy.id,
      context.organizationId
    );

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    await this.recordSequencePolicyLog(
      'sequence-policy-default',
      'CRM 默认序列策略更新',
      context,
      policy,
      currentPolicy.status,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Return one sequence policy scoped to the current organization. */
  async requireScopedSequencePolicy(id: string, context: CrmUserContext) {
    const policy = await this.sequencePolicyRepository.findSequencePolicyById({
      id,
      organizationId: context.organizationId
    });

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    return policy;
  }

  /** Return one active sequence policy and reject archived records. */
  async requireActiveSequencePolicy(id: string, context: CrmUserContext) {
    const policy = await this.requireScopedSequencePolicy(id, context);

    if (policy.status !== 'active') {
      throw new BadRequestException('序列策略已归档');
    }

    return policy;
  }

  private async runSequencePolicyWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('序列策略名称已存在');
      }

      throw error;
    }
  }

  private recordSequencePolicyLog(
    action: string,
    message: string,
    context: CrmUserContext,
    policy: CrmSequencePolicyRecord,
    fromStatus: CrmSequencePolicyRecord['status'] | null,
    toStatus: CrmSequencePolicyRecord['status']
  ) {
    return this.crmLogger?.record(action, message, context, {
      organizationId: policy.organizationId,
      policyId: policy.id,
      name: policy.name,
      status: policy.status,
      isDefault: policy.isDefault,
      linkPolicy: policy.linkPolicy,
      allowLowRiskAutoSend: policy.allowLowRiskAutoSend,
      sameCompanyContactStrategy: policy.sameCompanyContactStrategy,
      fromStatus,
      toStatus
    });
  }
}
