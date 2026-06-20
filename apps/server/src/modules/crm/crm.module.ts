import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemNotificationModule } from '../system-notification/system-notification.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { CrmService } from './crm.service';
import {
  crmControllers,
  crmDomainServices,
  crmIntegrationProviders,
  crmIntegrationServices,
  crmQueueProviders,
  crmRepositoryProviders,
  crmWorkerServices
} from './crm-module.providers';

@Module({
  imports: [AuthModule, DatabaseModule, RedisModule, SystemLogModule, SystemNotificationModule, AiGatewayModule],
  controllers: crmControllers,
  providers: [
    ...crmDomainServices,
    ...crmIntegrationServices,
    ...crmWorkerServices,
    ...crmRepositoryProviders,
    ...crmQueueProviders,
    ...crmIntegrationProviders
  ],
  exports: [CrmService]
})
export class CrmModule {}
