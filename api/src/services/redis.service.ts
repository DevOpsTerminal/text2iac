import Redis from 'ioredis';
import { injectable } from 'tsyringe';
import { config } from '../config';
import { logger } from '../utils/logger';

@injectable()
export class RedisService {
  private client: Redis;
  private static instance: RedisService;

  private constructor() {
    this.client = new Redis(config.redis.url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.setupEventListeners();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.debug('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    this.client.on('reconnecting', () => {
      logger.info('Reconnecting to Redis...');
    });
  }

  public getClient(): Redis {
    return this.client;
  }

  public async set(
    key: string,
    value: string | number | Buffer,
    expirySeconds?: number,
  ): Promise<'OK' | null> {
    try {
      if (expirySeconds) {
        return this.client.set(key, value, 'EX', expirySeconds);
      }
      return this.client.set(key, value);
    } catch (error) {
      logger.error('Redis set error:', error);
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      return this.client.get(key);
    } catch (error) {
      logger.error('Redis get error:', error);
      throw error;
    }
  }

  public async setex(
    key: string,
    seconds: number,
    value: string | number | Buffer,
  ): Promise<'OK'> {
    try {
      return this.client.setex(key, seconds, value);
    } catch (error) {
      logger.error('Redis setex error:', error);
      throw error;
    }
  }

  public async del(key: string): Promise<number> {
    try {
      return this.client.del(key);
    } catch (error) {
      logger.error('Redis del error:', error);
      throw error;
    }
  }

  public async expire(key: string, seconds: number): Promise<number> {
    try {
      return this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis expire error:', error);
      throw error;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      return this.client.ttl(key);
    } catch (error) {
      logger.error('Redis ttl error:', error);
      throw error;
    }
  }

  public async exists(key: string): Promise<number> {
    try {
      return this.client.exists(key);
    } catch (error) {
      logger.error('Redis exists error:', error);
      throw error;
    }
  }

  public async ping(): Promise<string> {
    try {
      return this.client.ping();
    } catch (error) {
      logger.error('Redis ping error:', error);
      throw error;
    }
  }

  public async quit(): Promise<'OK'> {
    try {
      return this.client.quit();
    } catch (error) {
      logger.error('Redis quit error:', error);
      throw error;
    }
  }

  // Static methods for direct usage without DI
  public static async set(
    key: string,
    value: string | number | Buffer,
    expirySeconds?: number,
  ): Promise<'OK' | null> {
    return RedisService.getInstance().set(key, value, expirySeconds);
  }

  public static async get(key: string): Promise<string | null> {
    return RedisService.getInstance().get(key);
  }

  public static async setex(
    key: string,
    seconds: number,
    value: string | number | Buffer,
  ): Promise<'OK'> {
    return RedisService.getInstance().setex(key, seconds, value);
  }

  public static async del(key: string): Promise<number> {
    return RedisService.getInstance().del(key);
  }

  public static async ping(): Promise<string> {
    return RedisService.getInstance().ping();
  }
}
