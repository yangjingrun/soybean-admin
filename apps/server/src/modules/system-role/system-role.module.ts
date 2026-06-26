import { Module } from '@nestjs/common';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemRoleController } from './system-role.controller';
import { SystemRoleService } from './system-role.service';

@Module({
  imports: [SystemLogModule],
  controllers: [SystemRoleController],
  providers: [SystemRoleService],
  exports: [SystemRoleService]
})
export class SystemRoleModule {}
