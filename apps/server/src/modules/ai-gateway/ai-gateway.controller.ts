import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../shared/api-response';
import { AiGatewayService } from './ai-gateway.service';
import { AiModelConfigKeyParamDto, SaveAiModelConfigDto } from './dto/ai-model-config.dto';
import { AiPromptKeyParamDto, SaveAiPromptDto } from './dto/ai-prompt.dto';
import { GenerateAiTextDto } from './dto/generate-ai-text.dto';

@Controller('ai-gateway')
export class AiGatewayController {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService) {}

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
  async generateText(@Body() dto: GenerateAiTextDto) {
    return ok(await this.aiGatewayService.generateText(dto));
  }
}
