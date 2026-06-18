import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { AiLeadsModule } from './ai-leads/ai-leads.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { SystemLogModule } from './system-log/system-log.module';
import { SystemNotificationModule } from './system-notification/system-notification.module';
import { SystemUserModule } from './system-user/system-user.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 60
        }
      ]
    }),
    RedisModule,
    AiGatewayModule,
    AiLeadsModule,
    AuthModule,
    SystemLogModule,
    SystemNotificationModule,
    SystemUserModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
