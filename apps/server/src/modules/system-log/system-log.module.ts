import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PrismaSystemLogStore } from './store/prisma-system-log.store';
import { SystemLogController } from './system-log.controller';
import { SystemLogService } from './system-log.service';
import { SYSTEM_LOG_STORE } from './system-log.tokens';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SystemLogController],
  providers: [
    SystemLogService,
    {
      provide: SYSTEM_LOG_STORE,
      useClass: PrismaSystemLogStore
    }
  ],
  exports: [SystemLogService]
})
export class SystemLogModule {}
