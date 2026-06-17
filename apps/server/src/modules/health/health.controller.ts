import { Controller, Get } from '@nestjs/common';
import { ok } from '../../shared/api-response';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return ok({
      status: 'up',
      service: 'soybean-nest-server',
      time: new Date().toISOString()
    });
  }
}
