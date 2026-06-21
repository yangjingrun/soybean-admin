import { Module } from '@nestjs/common';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemOrganizationController } from './system-organization.controller';
import { SystemOrganizationService } from './system-organization.service';

@Module({
  imports: [SystemLogModule],
  controllers: [SystemOrganizationController],
  providers: [SystemOrganizationService],
  exports: [SystemOrganizationService]
})
export class SystemOrganizationModule {}
