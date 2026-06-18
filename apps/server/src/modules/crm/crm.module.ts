import { Module } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CRM_EMAIL_DNS_RESOLVER, CRM_STORE } from './crm.tokens';
import { PrismaCrmStore } from './store/prisma-crm.store';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [CrmController],
  providers: [
    CrmService,
    {
      provide: CRM_STORE,
      useClass: PrismaCrmStore
    },
    {
      provide: CRM_EMAIL_DNS_RESOLVER,
      useValue: { resolveMx }
    }
  ],
  exports: [CrmService]
})
export class CrmModule {}
