import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PrismaSystemNotificationStore } from './store/prisma-system-notification.store';
import { SystemNotificationController } from './system-notification.controller';
import { SystemNotificationService } from './system-notification.service';
import { SYSTEM_NOTIFICATION_STORE } from './system-notification.tokens';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemNotificationController],
  providers: [
    SystemNotificationService,
    {
      provide: SYSTEM_NOTIFICATION_STORE,
      useClass: PrismaSystemNotificationStore
    }
  ],
  exports: [SystemNotificationService]
})
export class SystemNotificationModule {}
