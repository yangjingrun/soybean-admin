import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuthModule } from '../auth/auth.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import { AiLeadsController } from './ai-leads.controller';
import { AiLeadsService } from './ai-leads.service';

@Module({
  imports: [AiGatewayModule, AuthModule, SystemLogModule],
  controllers: [AiLeadsController],
  providers: [AiLeadsService, AiLeadSearchOrchestrator]
})
export class AiLeadsModule {}
