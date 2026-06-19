import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiModelConfigKeyParamDto, SaveAiModelConfigDto } from './dto/ai-model-config.dto';
import { AiPromptKeyParamDto, SaveAiPromptDto } from './dto/ai-prompt.dto';
import { GenerateAiTextDto } from './dto/generate-ai-text.dto';
import { HunterConfigKeyParamDto, SaveHunterConfigDto } from './dto/hunter-config.dto';
import { SaveSerperConfigDto, SerperConfigKeyParamDto } from './dto/serper-config.dto';

@Controller('ai-gateway')
export class AiGatewayController {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Post('prompts')
  async savePrompt(@Body() dto: SaveAiPromptDto, @Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.aiGatewayService.savePrompt(dto));
  }

  @Get('prompts/:promptKey')
  async getPrompt(@Param() params: AiPromptKeyParamDto, @Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.aiGatewayService.getPrompt(params.promptKey));
  }

  @Post('model-configs')
  async saveModelConfig(@Body() dto: SaveAiModelConfigDto, @Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.aiGatewayService.saveModelConfig(dto));
  }

  @Get('model-configs/:configKey')
  async getModelConfig(@Param() params: AiModelConfigKeyParamDto, @Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.aiGatewayService.getModelConfigDraft(params.configKey));
  }

  @Post('serper-configs')
  async saveSerperConfig(@Body() dto: SaveSerperConfigDto, @Headers('authorization') authorization = '') {
    const user = this.assertSuper(authorization);

    return ok(await this.aiGatewayService.saveSerperConfig(dto, { user }));
  }

  @Get('serper-configs/:configKey')
  async getSerperConfig(@Param() params: SerperConfigKeyParamDto, @Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.aiGatewayService.getSerperConfigDraft(params.configKey));
  }

  @Post('serper-configs/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testSerperConfig(@Body() dto: SaveSerperConfigDto, @Headers('authorization') authorization = '') {
    const user = this.assertSuper(authorization);

    return ok(await this.aiGatewayService.testSerperConfig(dto, { user }));
  }

  @Post('hunter-configs')
  async saveHunterConfig(@Body() dto: SaveHunterConfigDto, @Headers('authorization') authorization = '') {
    const user = this.assertSuper(authorization);

    return ok(await this.aiGatewayService.saveHunterConfig(dto, { user }));
  }

  @Get('hunter-configs/:configKey')
  async getHunterConfig(@Param() params: HunterConfigKeyParamDto, @Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.aiGatewayService.getHunterConfigDraft(params.configKey));
  }

  @Post('hunter-configs/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testHunterConfig(@Body() dto: SaveHunterConfigDto, @Headers('authorization') authorization = '') {
    const user = this.assertSuper(authorization);

    return ok(await this.aiGatewayService.testHunterConfig(dto, { user }));
  }

  @Post('generate-text')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async generateText(@Body() dto: GenerateAiTextDto, @Headers('authorization') authorization = '') {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    return ok(await this.aiGatewayService.generateText(dto, { user }));
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }

  private assertSuper(authorization: string) {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    if (!user?.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权维护 AI 配置');
    }

    return user;
  }
}
