import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiModelConfigKeyParamDto, SaveAiModelConfigDto } from './dto/ai-model-config.dto';
import { AiPromptKeyParamDto, SaveAiPromptDto } from './dto/ai-prompt.dto';
import { GenerateAiTextDto } from './dto/generate-ai-text.dto';

@Controller('ai-gateway')
export class AiGatewayController {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Post('prompts')
  async savePrompt(@Body() dto: SaveAiPromptDto) {
    return ok(await this.aiGatewayService.savePrompt(dto));
  }

  @Get('prompts/:promptKey')
  async getPrompt(@Param() params: AiPromptKeyParamDto) {
    return ok(await this.aiGatewayService.getPrompt(params.promptKey));
  }

  @Post('model-configs')
  async saveModelConfig(@Body() dto: SaveAiModelConfigDto) {
    return ok(await this.aiGatewayService.saveModelConfig(dto));
  }

  @Get('model-configs/:configKey')
  async getModelConfig(@Param() params: AiModelConfigKeyParamDto) {
    return ok(await this.aiGatewayService.getModelConfigDraft(params.configKey));
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
}
