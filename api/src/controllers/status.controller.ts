import { Get, Controller } from 'routing-controllers';
import { Service } from 'typedi';
import { BaseController } from './base.controller';
import { config } from '../config';
import { RedisService } from '../services/redis.service';

interface StatusResponse {
  status: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  database: {
    status: string;
  };
  redis: {
    status: string;
  };
  services: {
    [key: string]: string;
  };
}

@Service()
@Controller('/status')
export class StatusController extends BaseController {
  constructor(private redisService: RedisService) {
    super();
  }

  @Get('/')
  async getStatus() {
    try {
      // Check database connection
      let dbStatus = 'unknown';
      try {
        // Try a simple query to check database connection
        // This is a placeholder - you'll need to implement actual DB check
        dbStatus = 'connected';
      } catch (error) {
        dbStatus = 'error';
      }

      // Check Redis connection
      let redisStatus = 'unknown';
      try {
        await this.redisService.ping();
        redisStatus = 'connected';
      } catch (error) {
        redisStatus = 'error';
      }

      const response: StatusResponse = {
        status: 'ok',
        version: process.env.npm_package_version || '0.0.0',
        environment: config.env,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        database: {
          status: dbStatus,
        },
        redis: {
          status: redisStatus,
        },
        services: {
          database: dbStatus,
          redis: redisStatus,
          // Add other services as needed
        },
      };

      return this.success(response);
    } catch (error) {
      console.error('Error getting status:', error);
      return this.internalError('Failed to get system status');
    }
  }
}
