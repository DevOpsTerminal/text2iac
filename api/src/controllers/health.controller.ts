import { Get, Controller } from 'routing-controllers';
import { Service } from 'typedi';
import { BaseController } from './base.controller';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../health/redis.health';
import { DatabaseHealthIndicator } from '../health/database.health';

@Service()
@Controller('/health')
export class HealthController extends BaseController {
  constructor(
    private health: HealthCheckService,
    private redisHealth: RedisHealthIndicator,
    private dbHealth: DatabaseHealthIndicator,
  ) {
    super();
  }

  @Get()
  @HealthCheck()
  async check() {
    try {
      const result = await this.health.check([
        () => this.dbHealth.isHealthy('database'),
        () => this.redisHealth.isHealthy('redis'),
      ]);
      
      return this.success(result);
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'error',
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        details: {},
      };
      
      return this.internalError('Health check failed', result);
    }
  }

  @Get('/liveness')
  liveness() {
    return this.success({ status: 'ok' });
  }

  @Get('/readiness')
  @HealthCheck()
  async readiness() {
    try {
      await this.check();
      return this.success({ status: 'ready' });
    } catch (error) {
      return this.internalError('Service not ready', { status: 'error' });
    }
  }
}
