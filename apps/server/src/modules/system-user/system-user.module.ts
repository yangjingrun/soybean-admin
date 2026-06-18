import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemUserController } from './system-user.controller';
import { SystemUserService } from './system-user.service';

@Module({
  imports: [AuthModule, SystemLogModule],
  controllers: [SystemUserController],
  providers: [SystemUserService]
})
export class SystemUserModule {}
