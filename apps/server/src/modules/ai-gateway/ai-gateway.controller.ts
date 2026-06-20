import { Body, Controller, ForbiddenException, Get, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../shared/api-response';
import { assertSuper as assertSuperRole } from '../../shared/permission-policy';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import { CurrentContext, Roles } from '../auth/auth.decorators';
import { AiGatewayService } from './ai-gateway.service';
import { AiModelConfigKeyParamDto, SaveAiModelConfigDto } from './dto/ai-model-config.dto';
import { AiPromptKeyParamDto, SaveAiPromptDto } from './dto/ai-prompt.dto';
import { GenerateAiTextDto } from './dto/generate-ai-text.dto';
import { HunterConfigKeyParamDto, SaveHunterConfigDto } from './dto/hunter-config.dto';
import { SaveSerperConfigDto, SerperConfigKeyParamDto } from './dto/serper-config.dto';

@Controller('ai-gateway')
export class AiGatewayController {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService) {}

  @Post('prompts')
  @Roles('R_SUPER')
  async savePrompt(
    @Body() dto: SaveAiPromptDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.savePrompt(dto));
  }

  @Get('prompts/:promptKey')
  @Roles('R_SUPER')
  async getPrompt(
    @Param() params: AiPromptKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.getPrompt(params.promptKey));
  }

  @Post('model-configs')
  @Roles('R_SUPER')
  async saveModelConfig(
    @Body() dto: SaveAiModelConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.saveModelConfig(dto));
  }

  @Get('model-configs/:configKey')
  @Roles('R_SUPER')
  async getModelConfig(
    @Param() params: AiModelConfigKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.getModelConfigDraft(params.configKey));
  }

  @Post('serper-configs')
  @Roles('R_SUPER')
  async saveSerperConfig(
    @Body() dto: SaveSerperConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.saveSerperConfig(dto, { user: requireRequestUserContext(currentContext) }));
  }

  @Get('serper-configs/:configKey')
  @Roles('R_SUPER')
  async getSerperConfig(
    @Param() params: SerperConfigKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.getSerperConfigDraft(params.configKey));
  }

  @Post('serper-configs/test')
  @Roles('R_SUPER')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testSerperConfig(
    @Body() dto: SaveSerperConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.testSerperConfig(dto, { user: requireRequestUserContext(currentContext) }));
  }

  @Post('hunter-configs')
  @Roles('R_SUPER')
  async saveHunterConfig(
    @Body() dto: SaveHunterConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.saveHunterConfig(dto, { user: requireRequestUserContext(currentContext) }));
  }

  @Get('hunter-configs/:configKey')
  @Roles('R_SUPER')
  async getHunterConfig(
    @Param() params: HunterConfigKeyParamDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.getHunterConfigDraft(params.configKey));
  }

  @Post('hunter-configs/test')
  @Roles('R_SUPER')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testHunterConfig(
    @Body() dto: SaveHunterConfigDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    this.assertSuper(currentContext);

    return ok(await this.aiGatewayService.testHunterConfig(dto, { user: requireRequestUserContext(currentContext) }));
  }

  @Post('generate-text')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async generateText(
    @Body() dto: GenerateAiTextDto,
    @CurrentContext() currentContext: RequestUserContext | null = null
  ) {
    return ok(await this.aiGatewayService.generateText(dto, { user: requireRequestUserContext(currentContext) }));
  }

  private assertSuper(currentContext: RequestUserContext | null) {
    if (!currentContext) {
      throw new ForbiddenException('无权维护 AI 配置');
    }

    assertSuperRole(currentContext, '无权维护 AI 配置');
  }
}
