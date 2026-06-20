import { Controller, Get } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { Public } from '../auth/auth.decorators';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  getHealth() {
    return ok({
      status: 'up',
      service: 'soybean-nest-server',
      time: new Date().toISOString()
    });
  }
}
