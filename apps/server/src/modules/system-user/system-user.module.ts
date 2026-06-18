import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemUserController } from './system-user.controller';

@Module({
  imports: [AuthModule],
  controllers: [SystemUserController]
})
export class SystemUserModule {}
