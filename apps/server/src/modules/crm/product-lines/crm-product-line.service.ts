import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { createPageResult } from '../../../shared/pagination';
import { isOrganizationAdmin as hasOrganizationAdminRole } from '../../../shared/permission-policy';
import type {
  CrmProductLineAiWritingConfig,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmUserContext
} from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { CRM_PRODUCT_LINE_REPOSITORY, type CrmProductLineRepository } from './crm-product-line.repository';
import {
  hasOwn,
  normalizeProductLineCreateInput,
  normalizeProductLineUpdateInput,
  toProductLineAiPromptVersionView,
  toProductLineView,
  toStableAiWritingConfigKey,
  type ProductLineCreateInput,
  type ProductLineUpdateInput
} from './crm-product-line-rules';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const defaultProductLineStatus: CrmProductLineStatus = 'active';

@Injectable()
export class CrmProductLineService {
  constructor(
    @Inject(CRM_PRODUCT_LINE_REPOSITORY) private readonly productLineRepository: CrmProductLineRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Lists organization-level product lines for the current organization. */
  async listProductLines(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmProductLineStatus;
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.productLineRepository.listProductLines({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toProductLineView)
    });
  }

  /** Creates an organization-level product line after checking name uniqueness. */
  async createProductLine(input: ProductLineCreateInput, context: CrmUserContext) {
    const data = normalizeProductLineCreateInput(input);
    this.assertCanWriteProductLineAiConfig(input, data.aiWritingConfig, context);
    await this.assertProductLineNameAvailable(context.organizationId, data.name);
    const productLine = await this.runProductLineWrite(() =>
      this.productLineRepository.createProductLine({
        organizationId: context.organizationId,
        ...data,
        status: defaultProductLineStatus,
        createdById: context.userId,
        createdByName: context.userName
      })
    );

    await this.recordProductLineLog(
      'product-line-create',
      'CRM 产品资料新建',
      context,
      productLine,
      null,
      productLine.status
    );
    await this.createProductLineAiPromptVersionIfPresent(productLine, context, '初始 AI 写信配置');

    return { productLine: toProductLineView(productLine) };
  }

  /** Updates an organization-level product line through organization scoped reads and writes. */
  async updateProductLine(id: string, input: ProductLineUpdateInput, context: CrmUserContext) {
    const currentProductLine = await this.requireScopedProductLine(id, context);
    const fromStatus = currentProductLine.status;
    const previousAiWritingConfigKey = toStableAiWritingConfigKey(currentProductLine.aiWritingConfig);
    const data = normalizeProductLineUpdateInput(input);
    this.assertCanWriteProductLineAiConfig(input, data.aiWritingConfig, context);

    if (data.name && data.name !== currentProductLine.name) {
      await this.assertProductLineNameAvailable(context.organizationId, data.name, currentProductLine.id);
    }

    const productLine = await this.runProductLineWrite(() =>
      this.productLineRepository.updateProductLine(currentProductLine.id, context.organizationId, data)
    );

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    await this.recordProductLineLog(
      'product-line-update',
      'CRM 产品资料更新',
      context,
      productLine,
      fromStatus,
      productLine.status
    );
    await this.createProductLineAiPromptVersionIfChanged(
      previousAiWritingConfigKey,
      productLine,
      context,
      'AI 写信配置更新'
    );

    return { productLine: toProductLineView(productLine) };
  }

  /** Lists AI prompt versions for an organization-scoped product line. */
  async listProductLineAiPromptVersions(id: string, context: CrmUserContext) {
    const productLine = await this.requireScopedProductLine(id, context);
    const records = await this.productLineRepository.listProductLineAiPromptVersions({
      organizationId: context.organizationId,
      productLineId: productLine.id
    });

    return {
      records: records.map(toProductLineAiPromptVersionView)
    };
  }

  /** Restores a saved AI prompt version to the current product-line config. */
  async restoreProductLineAiPromptVersion(id: string, versionId: string, context: CrmUserContext) {
    if (!hasOrganizationAdminRole(context)) {
      throw new ForbiddenException('只有组织管理员可以恢复 AI 写信配置版本');
    }

    const productLine = await this.requireScopedProductLine(id, context);
    const restored = await this.productLineRepository.restoreProductLineAiPromptVersion({
      organizationId: context.organizationId,
      productLineId: productLine.id,
      versionId,
      editorId: context.userId,
      editorName: context.userName,
      changeSummary: undefined
    });

    if (!restored) {
      throw new NotFoundException('AI 写信配置版本不存在');
    }

    await this.crmLogger?.record('product-line-ai-prompt-version-restore', 'CRM 产品线 AI 写信配置恢复历史版本', context, {
      organizationId: context.organizationId,
      productLineId: productLine.id,
      restoredVersionId: restored.restoredVersion.id,
      restoredVersion: restored.restoredVersion.version,
      newVersion: restored.currentVersion.version
    });

    return {
      productLine: toProductLineView(restored.productLine),
      version: toProductLineAiPromptVersionView(restored.currentVersion)
    };
  }

  /** Archives an organization-level product line through organization scoped reads and writes. */
  async archiveProductLine(id: string, context: CrmUserContext) {
    const currentProductLine = await this.requireScopedProductLine(id, context);
    const fromStatus = currentProductLine.status;
    const productLine = await this.productLineRepository.updateProductLine(
      currentProductLine.id,
      context.organizationId,
      {
        status: 'archived'
      }
    );

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    await this.recordProductLineLog(
      'product-line-archive',
      'CRM 产品资料归档',
      context,
      productLine,
      fromStatus,
      productLine.status
    );

    return { productLine: toProductLineView(productLine) };
  }

  /** Return one product line that belongs to the current organization. */
  async requireScopedProductLine(id: string, context: CrmUserContext) {
    const productLine = await this.productLineRepository.findProductLineById({
      id,
      organizationId: context.organizationId
    });

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    return productLine;
  }

  /** Return one active product line and reject archived records for write flows. */
  async requireActiveProductLine(id: string, context: CrmUserContext) {
    const productLine = await this.requireScopedProductLine(id, context);

    if (productLine.status !== 'active') {
      throw new BadRequestException('产品资料已归档');
    }

    return productLine;
  }

  private async assertProductLineNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingProductLine = await this.productLineRepository.findProductLineByName(organizationId, name);

    if (existingProductLine && existingProductLine.id !== ignoredId) {
      throw new BadRequestException('产品资料名称已存在');
    }
  }

  /** Creates a prompt version when the product line has a normalized AI writing config. */
  private async createProductLineAiPromptVersionIfPresent(
    productLine: CrmProductLineRecord,
    context: CrmUserContext,
    changeSummary: string
  ) {
    if (!productLine.aiWritingConfig) return;

    await this.productLineRepository.createProductLineAiPromptVersion({
      organizationId: productLine.organizationId,
      productLineId: productLine.id,
      aiWritingConfig: productLine.aiWritingConfig,
      editorId: context.userId,
      editorName: context.userName,
      changeSummary
    });
  }

  /** Adds a prompt version only when normalized AI config JSON differs semantically. */
  private async createProductLineAiPromptVersionIfChanged(
    previousConfigKey: string,
    productLine: CrmProductLineRecord,
    context: CrmUserContext,
    changeSummary: string
  ) {
    if (previousConfigKey === toStableAiWritingConfigKey(productLine.aiWritingConfig)) return;

    await this.productLineRepository.createProductLineAiPromptVersion({
      organizationId: productLine.organizationId,
      productLineId: productLine.id,
      aiWritingConfig: productLine.aiWritingConfig,
      editorId: context.userId,
      editorName: context.userName,
      changeSummary
    });
  }

  private assertCanWriteProductLineAiConfig(
    input: ProductLineCreateInput | ProductLineUpdateInput,
    config: CrmProductLineAiWritingConfig | null | undefined,
    context: CrmUserContext
  ) {
    if (!hasOwn(input, 'aiWritingConfig')) return;

    const hasInstruction = Boolean(
      config?.enabled ||
        config?.commonRequirements ||
        config?.forbiddenClaims ||
        config?.productEmphasis ||
        config?.steps.some(step => step.prompt)
    );

    if (hasInstruction && !hasOrganizationAdminRole(context)) {
      throw new ForbiddenException('只有组织管理员可以编辑 AI 写信配置');
    }
  }

  private async runProductLineWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('产品资料名称已存在');
      }

      throw error;
    }
  }

  private recordProductLineLog(
    action: string,
    message: string,
    context: CrmUserContext,
    productLine: CrmProductLineRecord,
    fromStatus: CrmProductLineStatus | null,
    toStatus: CrmProductLineStatus
  ) {
    return this.crmLogger?.record(action, message, context, {
      organizationId: productLine.organizationId,
      productLineId: productLine.id,
      name: productLine.name,
      status: productLine.status,
      fromStatus,
      toStatus
    });
  }
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
