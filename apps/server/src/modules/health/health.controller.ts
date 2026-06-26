import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { fail, ok } from '../../shared/api-response';
import { Public } from '../auth/auth.decorators';
import { HealthService } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  getHealth() {
    return ok(this.healthService.getLiveness());
  }

  @Get('live')
  @Public()
  getLiveness() {
    return ok(this.healthService.getLiveness());
  }

  @Get('ready')
  @Public()
  async getReadiness(@Res({ passthrough: true }) response: FastifyReply) {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === 'down') {
      response.status(503);

      return fail('503', 'Service unavailable', readiness);
    }

    return ok(readiness);
  }
}
