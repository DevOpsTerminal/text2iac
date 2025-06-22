import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({
  path: path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? '.env.test' : '.env'),
});

// Define environment variable schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  LOG_LEVEL: z.string().default('info'),
  
  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/text2iac'),
  
  // Authentication
  JWT_SECRET: z.string().default('your-secret-key'),
  API_KEYS: z.string().default('').transform(keys => 
    keys.split(',').map(key => key.trim()).filter(Boolean)
  ),
  
  // LLM
  OPENAI_API_KEY: z.string().optional(),
  MODEL_NAME: z.string().default('gpt-4'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().default('100'),
});

// Validate environment variables
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
  console.error('❌ Invalid environment variables:', envValidation.error.format());
  process.exit(1);
}

// Export validated config
export const config = {
  env: envValidation.data.NODE_ENV,
  port: envValidation.data.PORT,
  logLevel: envValidation.data.LOG_LEVEL,
  
  database: {
    url: envValidation.data.DATABASE_URL,
  },
  
  auth: {
    jwtSecret: envValidation.data.JWT_SECRET,
    apiKeys: envValidation.data.API_KEYS,
  },
  
  llm: {
    openaiApiKey: envValidation.data.OPENAI_API_KEY,
    modelName: envValidation.data.MODEL_NAME,
  },
  
  redis: {
    url: envValidation.data.REDIS_URL,
  },
  
  rateLimit: {
    windowMs: parseInt(envValidation.data.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(envValidation.data.RATE_LIMIT_MAX, 10),
  },
  
  isProduction: envValidation.data.NODE_ENV === 'production',
  isDevelopment: envValidation.data.NODE_ENV === 'development',
  isTest: envValidation.data.NODE_ENV === 'test',
} as const;
