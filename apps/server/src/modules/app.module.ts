import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './app-config/app-config.module';
import { AppConfigService } from './app-config/app-config.service';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { AiLeadsModule } from './ai-leads/ai-leads.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { CrmModule } from './crm/crm.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { SystemLogModule } from './system-log/system-log.module';
import { SystemNotificationModule } from './system-notification/system-notification.module';
import { SystemOrganizationModule } from './system-organization/system-organization.module';
import { SystemRoleModule } from './system-role/system-role.module';
import { SystemUserModule } from './system-user/system-user.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => ({
        // 开发环境调试登录、AI 任务时请求频率高，限流只在生产环境启用。
        skipIf: () => !appConfigService.config.isProduction,
        throttlers: [
          {
            ttl: 60000,
            limit: 60
          }
        ]
      })
    }),
    RedisModule,
    AiGatewayModule,
    AiLeadsModule,
    AuthModule,
    CrmModule,
    SystemLogModule,
    SystemNotificationModule,
    SystemOrganizationModule,
    SystemRoleModule,
    SystemUserModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ]
})
export class AppModule {}
