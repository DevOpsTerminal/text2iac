import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Define log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  const stackString = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]: ${message}${metaString}${stackString}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    config.isProduction ? json() : combine(colorize(), logFormat)
  ),
  defaultMeta: { service: 'text2iac-api' },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with level `info` and below to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  exitOnError: false,
});

// If we're not in production, log to the console as well
if (!config.isProduction) {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      logFormat
    ),
  }));
}

// Create a stream for morgan (HTTP request logging)
export const httpStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Handle uncaught exceptions
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

export { logger };

// Example usage:
// import { logger } from './utils/logger';
// logger.info('Info message');
// logger.error('Error message', { error: err });
// logger.warn('Warning message', { someData });
// logger.debug('Debug message', { debugInfo });
