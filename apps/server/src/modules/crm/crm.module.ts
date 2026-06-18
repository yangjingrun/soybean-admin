import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CRM_STORE } from './crm.tokens';
import { PrismaCrmStore } from './store/prisma-crm.store';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [CrmController],
  providers: [
    CrmService,
    {
      provide: CRM_STORE,
      useClass: PrismaCrmStore
    }
  ],
  exports: [CrmService]
})
export class CrmModule {}
