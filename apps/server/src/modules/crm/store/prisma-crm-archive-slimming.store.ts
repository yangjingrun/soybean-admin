import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CrmArchiveSlimmingRepository } from '../crm-archive-slimming.repository';
import { PrismaCrmAccountStore } from './prisma-crm-account.store';

@Injectable()
export class PrismaCrmArchiveSlimmingStore implements CrmArchiveSlimmingRepository {
  private readonly accountStore: PrismaCrmAccountStore;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.accountStore = new PrismaCrmAccountStore(prisma);
  }

  listAccountsForArchiveSlimming(
    ...args: Parameters<PrismaCrmAccountStore['listAccountsForArchiveSlimming']>
  ): ReturnType<PrismaCrmAccountStore['listAccountsForArchiveSlimming']> {
    return this.accountStore.listAccountsForArchiveSlimming(...args);
  }

  slimArchivedAccount(
    ...args: Parameters<PrismaCrmAccountStore['slimArchivedAccount']>
  ): ReturnType<PrismaCrmAccountStore['slimArchivedAccount']> {
    return this.accountStore.slimArchivedAccount(...args);
  }
}
