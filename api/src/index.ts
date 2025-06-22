import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { useContainer } from 'routing-controllers';
import { Container } from 'tsyringe';
import { createExpressServer } from 'routing-controllers';
import { Text2IacController } from './controllers/text2iac.controller';
import { StatusController } from './controllers/status.controller';
import { HealthController } from './controllers/health.controller';
import { ErrorMiddleware } from './middleware/error.middleware';
import { Logger } from './utils/logger';
import { config } from './config';

// Setup dependency injection container
useContainer({ get: (token) => Container.resolve(token as any) });

// Initialize logger
const logger = new Logger('Server');

async function bootstrap() {
  try {
    // Initialize database connection
    await createConnection({
      type: 'postgres',
      url: config.database.url,
      entities: [`${__dirname}/entities/*.entity.{js,ts}`],
      synchronize: config.env === 'development',
      logging: config.env === 'development',
    });

    logger.info('Database connection established');

    // Create Express app with routing-controllers
    const app = createExpressServer({
      cors: true,
      routePrefix: '/api',
      defaultErrorHandler: false,
      middlewares: [ErrorMiddleware],
      controllers: [Text2IacController, StatusController, HealthController],
    });

    // Start the server
    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
bootstrap();
