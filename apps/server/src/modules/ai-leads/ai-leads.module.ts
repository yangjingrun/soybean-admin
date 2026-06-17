import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuthModule } from '../auth/auth.module';
import { AiLeadsController } from './ai-leads.controller';
import { AiLeadsService } from './ai-leads.service';

@Module({
  imports: [AiGatewayModule, AuthModule],
  controllers: [AiLeadsController],
  providers: [AiLeadsService]
})
export class AiLeadsModule {}
