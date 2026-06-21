import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

const serviceName = 'AI外贸管理系统-nest-server';
const dependencyTimeoutMs = 1500;

export type HealthDependencyStatus = 'up' | 'down';
export type HealthStatus = 'up' | 'down';

export interface HealthProbeDependency {
  status: HealthDependencyStatus;
  error?: string;
}

export interface HealthProbeResult {
  status: HealthStatus;
  service: string;
  role: string;
  time: string;
}

export interface HealthReadinessResult extends HealthProbeResult {
  dependencies: {
    database: HealthProbeDependency;
    redis: HealthProbeDependency;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: Pick<PrismaService, '$queryRaw'>,
    @Inject(RedisService) private readonly redis: Pick<RedisService, 'getClient'>,
    @Optional() @Inject(AppConfigService) private readonly appConfigService?: AppConfigService
  ) {}

  /** Returns process-only liveness without touching external dependencies. */
  getLiveness(): HealthProbeResult {
    return this.buildBaseResult('up');
  }

  /** Checks required request-path dependencies with bounded lightweight pings. */
  async getReadiness(): Promise<HealthReadinessResult> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status: HealthStatus = database.status === 'up' && redis.status === 'up' ? 'up' : 'down';

    return {
      ...this.buildBaseResult(status),
      dependencies: {
        database,
        redis
      }
    };
  }

  private async checkDatabase(): Promise<HealthProbeDependency> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, dependencyTimeoutMs);

      return { status: 'up' };
    } catch (error) {
      return { status: 'down', error: normalizeHealthError(error) };
    }
  }

  private async checkRedis(): Promise<HealthProbeDependency> {
    try {
      const result = await withTimeout(this.redis.getClient().ping(), dependencyTimeoutMs);

      return result === 'PONG' ? { status: 'up' } : { status: 'down', error: 'Unexpected Redis ping response' };
    } catch (error) {
      return { status: 'down', error: normalizeHealthError(error) };
    }
  }

  private buildBaseResult(status: HealthStatus): HealthProbeResult {
    return {
      status,
      service: serviceName,
      role: this.appConfigService?.config.serverRuntimeRole ?? 'all',
      time: new Date().toISOString()
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Health check timed out after ${timeoutMs}ms`)), timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

function normalizeHealthError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Dependency check failed';
}
