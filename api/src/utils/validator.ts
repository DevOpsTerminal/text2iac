import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class Validator {
  /**
   * Validates the request and sends a 400 response if validation fails
   */
  static validate(validations: ValidationChain[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      logger.warn('Validation failed', { 
        path: req.path, 
        method: req.method,
        errors: errors.array() 
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    };
  }

  // Common validation rules
  static readonly uuid = param('id')
    .isUUID(4)
    .withMessage('Invalid ID format');

  static readonly pagination = [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('sort')
      .optional()
      .isString()
      .trim()
      .isIn(['asc', 'desc'])
      .withMessage('Sort must be either "asc" or "desc")
      .toLowerCase(),
  ];

  // Request body schemas
  static readonly createInfrastructureRequest = [
    body('description')
      .isString()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('environment')
      .optional()
      .isIn(['development', 'staging', 'production'])
      .withMessage('Environment must be one of: development, staging, production'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be one of: low, medium, high, critical'),
    body('requestor')
      .optional()
      .isEmail()
      .withMessage('Requestor must be a valid email address')
      .normalizeEmail(),
    body('template')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Template name must be between 1 and 100 characters'),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object'),
    body('options.includeMonitoring')
      .optional()
      .isBoolean()
      .withMessage('includeMonitoring must be a boolean'),
    body('options.includeCI')
      .optional()
      .isBoolean()
      .withMessage('includeCI must be a boolean'),
    body('options.cloudProvider')
      .optional()
      .isIn(['aws', 'azure', 'gcp', 'local'])
      .withMessage('cloudProvider must be one of: aws, azure, gcp, local'),
    body('options.region')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Region must be between 2 and 50 characters'),
  ];

  static readonly updateInfrastructureRequest = [
    param('id')
      .isUUID(4)
      .withMessage('Invalid ID format'),
    body('status')
      .optional()
      .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled'])
      .withMessage('Invalid status value'),
    body('message')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Message must be less than 1000 characters'),
  ];

  // API Key validation middleware
  static validateApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      logger.warn('API key missing', { 
        path: req.path, 
        method: req.method 
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'API key is required',
        },
      });
    }

    // In a real app, you would validate the API key against your database
    const isValidApiKey = config.auth.apiKeys.includes(String(apiKey));
    
    if (!isValidApiKey) {
      logger.warn('Invalid API key', { 
        path: req.path, 
        method: req.method 
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'Invalid API key',
        },
      });
    }

    next();
  }

  // Request ID middleware
  static requestId(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
    
    // Add request ID to the request object
    req.requestId = String(requestId);
    
    // Add request ID to the response headers
    res.setHeader('X-Request-Id', req.requestId);
    
    next();
  }

  // Rate limiting middleware
  static rateLimit(limit: number, windowMs: number) {
    const rateLimits = new Map<string, { count: number; resetTime: number }>();
    
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      // Get or initialize rate limit for this IP
      const rateLimit = rateLimits.get(key) || { count: 0, resetTime: now + windowMs };
      
      // Reset the counter if the window has passed
      if (now > rateLimit.resetTime) {
        rateLimit.count = 0;
        rateLimit.resetTime = now + windowMs;
      }
      
      // Check if the limit has been exceeded
      if (rateLimit.count >= limit) {
        const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);
        
        res.setHeader('Retry-After', String(retryAfter));
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));
        
        return res.status(429).json({
          success: false,
          error: {
            code: 'rate_limit_exceeded',
            message: `Too many requests, please try again in ${retryAfter} seconds`,
            retryAfter,
          },
        });
      }
      
      // Increment the counter
      rateLimit.count++;
      rateLimits.set(key, rateLimit);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(limit - rateLimit.count));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));
      
      next();
    };
  }
}
