// api/src/app.ts - Main API Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import promMiddleware from 'express-prometheus-middleware';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { logger } from './utils/logger';
import { validateEnv } from './utils/validator';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// Controllers
import { text2iacController } from './controllers/text2iac.controller';
import { statusController } from './controllers/status.controller';
import { healthController } from './controllers/health.controller';
import { templateController } from './controllers/template.controller';

// Services
import { DatabaseService } from './services/database.service';
import { RedisService } from './services/redis.service';

class App {
  public app: express.Application;
  public server: any;
  public wss: WebSocketServer;
  
  constructor() {
    this.app = express();
    this.initializeEnvironment();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeWebSocket();
  }

  private initializeEnvironment(): void {
    validateEnv();
    logger.info('Environment variables validated');
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8080'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info(message.trim());
        },
      },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Prometheus metrics
    this.app.use(promMiddleware({
      metricsPath: '/metrics',
      collectDefaultMetrics: true,
      requestDurationBuckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10],
    }));

    logger.info('Middlewares initialized');
  }

  private initializeRoutes(): void {
    // Health check (no auth required)
    this.app.use('/health', healthController);

    // API routes with authentication
    this.app.use('/api/generate', authMiddleware, text2iacController);
    this.app.use('/api/status', authMiddleware, statusController);
    this.app.use('/api/templates', authMiddleware, templateController);

    // Public routes (minimal auth)
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'Text2IaC API',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Static file serving (for generated files)
    this.app.use('/api/files', 
      authMiddleware, 
      express.static('generated', {
        maxAge: '1d',
        etag: true,
      })
    );

    logger.info('Routes initialized');
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
    
    logger.info('Error handling initialized');
  }

  private initializeWebSocket(): void {
    this.server = createServer(this.app);
    
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      logger.info(`WebSocket connection established from ${req.socket.remoteAddress}`);
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.info('WebSocket message received:', data);
          
          // Handle different message types
          switch (data.type) {
            case 'subscribe':
              // Subscribe to status updates
              ws.send(JSON.stringify({
                type: 'subscribed',
                requestId: data.requestId,
              }));
              break;
              
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type',
              }));
          }
        } catch (error) {
          logger.error('WebSocket message parsing error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Text2IaC API',
        timestamp: new Date().toISOString(),
      }));
    });

    logger.info('WebSocket server initialized');
  }

  public async listen(port: number): Promise<void> {
    try {
      // Initialize database connection
      await DatabaseService.initialize();
      logger.info('Database connection established');

      // Initialize Redis connection
      await RedisService.initialize();
      logger.info('Redis connection established');

      // Start server
      this.server.listen(port, () => {
        logger.info(`🚀 Text2IaC API server running on port ${port}`);
        logger.info(`📊 Metrics available at http://localhost:${port}/metrics`);
        logger.info(`🔌 WebSocket endpoint: ws://localhost:${port}/ws`);
        logger.info(`💡 Health check: http://localhost:${port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Received shutdown signal, starting graceful shutdown...');

    // Close WebSocket server
    this.wss.close(() => {
      logger.info('WebSocket server closed');
    });

    // Close HTTP server
    this.server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection
        await DatabaseService.close();
        logger.info('Database connection closed');

        // Close Redis connection
        await RedisService.close();
        logger.info('Redis connection closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  // Method to broadcast status updates via WebSocket
  public broadcastStatusUpdate(requestId: string, status: any): void {
    const message = JSON.stringify({
      type: 'status_update',
      requestId,
      status,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }
}

export default App;
