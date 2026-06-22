import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { aiSettingsPromptManagePermission, type PermissionCode } from '@soybean/shared';
import { ok } from '../../shared/api-response';
import { requirePermission, requireSuperUserContext } from '../../shared/permission-policy';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import { CurrentContext } from '../auth/auth.decorators';
import { AiGatewayService } from './ai-gateway.service';
import { AiModelConfigKeyParamDto, SaveAiModelConfigDto, SaveMyAiModelConfigDto } from './dto/ai-model-config.dto';
import {
  AiPromptKeyParamDto,
  PublishAiPromptDraftDto,
  RollbackAiPromptVersionDto,
  SaveAiPromptDraftDto,
  SaveAiPromptDto,
  TestAiPromptDraftDto,
  ValidateAiPromptDraftDto
} from './dto/ai-prompt.dto';
import { GenerateAiTextDto } from './dto/generate-ai-text.dto';
import { HunterConfigKeyParamDto, SaveHunterConfigDto, SaveMyHunterConfigDto } from './dto/hunter-config.dto';
import { SaveMySerperConfigDto, SaveSerperConfigDto, SerperConfigKeyParamDto } from './dto/serper-config.dto';

@Controller('ai-gateway')
export class AiGatewayController {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService) {}

  @Get('prompt-workbench/steps')
  async listPromptWorkbenchSteps(@CurrentContext() currentContext: RequestUserContext | null = null) {
    this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.listPromptWorkbenchSteps());
  }

  @Get('prompt-workbench/steps/:promptKey')
  async getPromptWorkbenchDetail(
    @Param() params: AiPromptKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.getPromptWorkbenchDetail(params.promptKey));
  }

  @Post('prompt-workbench/drafts/validate')
  async validatePromptDraft(
    @Body() dto: ValidateAiPromptDraftDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(this.aiGatewayService.validatePromptDraft(dto.promptKey, dto.systemPrompt));
  }

  @Post('prompt-workbench/drafts')
  async savePromptDraft(
    @Body() dto: SaveAiPromptDraftDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.savePromptDraft(dto, user));
  }

  @Post('prompt-workbench/drafts/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testPromptDraft(
    @Body() dto: TestAiPromptDraftDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.testPromptDraft(dto, user));
  }

  @Post('prompt-workbench/drafts/publish')
  async publishPromptDraft(
    @Body() dto: PublishAiPromptDraftDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.publishPromptDraft(dto, user));
  }

  @Post('prompt-workbench/versions/rollback')
  async rollbackPromptVersion(
    @Body() dto: RollbackAiPromptVersionDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.rollbackPromptVersion(dto, user));
  }

  @Post('prompts')
  async savePrompt(@Body() dto: SaveAiPromptDto, @CurrentContext() currentContext: RequestUserContext | null = null) {
    this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.savePrompt(dto));
  }

  @Get('prompts/:promptKey')
  async getPrompt(
    @Param() params: AiPromptKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.getPrompt(params.promptKey));
  }

  @Get('prompts/:promptKey/default')
  async getDefaultPrompt(
    @Param() params: AiPromptKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.requireAiConfigPermission(currentContext, aiSettingsPromptManagePermission);

    return ok(await this.aiGatewayService.getDefaultPromptDraft(params.promptKey));
  }

  @Post('model-configs')
  async saveModelConfig(
    @Body() dto: SaveAiModelConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.saveModelConfig(dto));
  }

  @Get('model-configs/:configKey')
  async getModelConfig(
    @Param() params: AiModelConfigKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.getModelConfigDraft(params.configKey));
  }

  @Get('my-model-config')
  async getMyModelConfig(@CurrentContext() currentContext: RequestUserContext | null = null) {
    return ok(await this.aiGatewayService.getMyModelConfigDraft(requireRequestUserContext(currentContext)));
  }

  @Post('my-model-config')
  async saveMyModelConfig(
    @Body() dto: SaveMyAiModelConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.saveMyModelConfig(dto, requireRequestUserContext(currentContext)));
  }

  @Post('serper-configs')
  async saveSerperConfig(
    @Body() dto: SaveSerperConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.saveSerperConfig(dto, { user }));
  }

  @Get('serper-configs/:configKey')
  async getSerperConfig(
    @Param() params: SerperConfigKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.getSerperConfigDraft(params.configKey));
  }

  @Post('serper-configs/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testSerperConfig(
    @Body() dto: SaveSerperConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.testSerperConfig(dto, { user }));
  }

  @Get('my-serper-config')
  async getMySerperConfig(@CurrentContext() currentContext: RequestUserContext | null = null) {
    return ok(await this.aiGatewayService.getMySerperConfigDraft(requireRequestUserContext(currentContext)));
  }

  @Post('my-serper-config')
  async saveMySerperConfig(
    @Body() dto: SaveMySerperConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.saveMySerperConfig(dto, requireRequestUserContext(currentContext)));
  }

  @Post('my-serper-config/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testMySerperConfig(
    @Body() dto: SaveMySerperConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.testMySerperConfig(dto, requireRequestUserContext(currentContext)));
  }

  @Post('hunter-configs')
  async saveHunterConfig(
    @Body() dto: SaveHunterConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.saveHunterConfig(dto, { user }));
  }

  @Get('hunter-configs/:configKey')
  async getHunterConfig(
    @Param() params: HunterConfigKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.getHunterConfigDraft(params.configKey));
  }

  @Post('hunter-configs/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testHunterConfig(
    @Body() dto: SaveHunterConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    const user = requireSuperUserContext(currentContext, '无权维护 AI 配置');

    return ok(await this.aiGatewayService.testHunterConfig(dto, { user }));
  }

  @Get('my-hunter-config')
  async getMyHunterConfig(@CurrentContext() currentContext: RequestUserContext | null = null) {
    return ok(await this.aiGatewayService.getMyHunterConfigDraft(requireRequestUserContext(currentContext)));
  }

  @Post('my-hunter-config')
  async saveMyHunterConfig(
    @Body() dto: SaveMyHunterConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.saveMyHunterConfig(dto, requireRequestUserContext(currentContext)));
  }

  @Post('my-hunter-config/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testMyHunterConfig(
    @Body() dto: SaveMyHunterConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.testMyHunterConfig(dto, requireRequestUserContext(currentContext)));
  }

  @Post('generate-text')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async generateText(
    @Body() dto: GenerateAiTextDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.generateText(dto, { user: requireRequestUserContext(currentContext) }));
  }

  private requireAiConfigPermission(currentContext: RequestUserContext | null, permission: PermissionCode) {
    const user = requireRequestUserContext(currentContext);

    requirePermission(user, permission, '无权维护 AI 配置');

    return user;
  }
}
