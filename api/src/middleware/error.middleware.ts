import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class ErrorMiddleware {
  /**
   * Handles 404 Not Found errors
   */
  static notFound(req: Request, res: Response, next: NextFunction) {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  }

  /**
   * Global error handler
   */
  static errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    // Default to 500 (Internal Server Error) if status code not set
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // Log the error
    logger.error(err.message, {
      status: statusCode,
      path: req.path,
      method: req.method,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      requestId: req.requestId,
    });

    // Determine the error message based on environment
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Something went wrong!'
      : err.message;

    // Send error response
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'internal_error',
        message,
        ...(process.env.NODE_ENV !== 'production' && {
          stack: err.stack,
          details: err.details,
        }),
      },
      requestId: req.requestId,
    });
  }

  /**
   * Handle async/await errors in route handlers
   */
  static catchAsync(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Handle JWT authentication errors
   */
  static handleJWTError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'invalid_token',
          message: 'Invalid token',
        },
      });
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'token_expired',
          message: 'Token expired',
        },
      });
    }

    next(err);
  }

  /**
   * Handle MongoDB validation errors
   */
  static handleValidationError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e: any) => ({
        field: e.path,
        message: e.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: errors,
        },
      });
    }

    next(err);
  }

  /**
   * Handle MongoDB duplicate key errors
   */
  static handleDuplicateKeyError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'duplicate_key',
          message: `The ${field} already exists`,
          field,
          value: err.keyValue[field],
        },
      });
    }

    next(err);
  }

  /**
   * Handle invalid MongoDB IDs
   */
  static handleCastError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_id',
          message: `Invalid ${err.path}: ${err.value}`,
          path: err.path,
          value: err.value,
        },
      });
    }

    next(err);
  }

  /**
   * Handle rate limit exceeded errors
   */
  static handleRateLimitExceeded(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.status === 429) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'rate_limit_exceeded',
          message: 'Too many requests, please try again later',
          retryAfter: err.retryAfter,
        },
      });
    }

    next(err);
  }

  /**
   * Handle CORS errors
   */
  static handleCorsError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.name === 'CorsError') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'cors_error',
          message: 'Not allowed by CORS',
        },
      });
    }

    next(err);
  }

  /**
   * Handle file upload errors
   */
  static handleFileUploadError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: {
          code: 'file_too_large',
          message: 'File size is too large',
          maxSize: err.limit,
        },
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'too_many_files',
          message: 'Too many files uploaded',
          maxFiles: err.limit,
        },
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_file_field',
          message: `Unexpected file field: ${err.field}`,
          field: err.field,
        },
      });
    }

    next(err);
  }

  /**
   * Handle CSRF token errors
   */
  static handleCsrfError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'invalid_csrf_token',
          message: 'Invalid CSRF token',
        },
      });
    }

    next(err);
  }

  /**
   * Handle invalid JSON in request body
   */
  static handleJsonError(err: any, req: Request, res: Response, next: NextFunction) {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_json',
          message: 'Invalid JSON in request body',
          details: err.message,
        },
      });
    }

    next(err);
  }

  /**
   * Handle 405 Method Not Allowed
   */
  static methodNotAllowed(req: Request, res: Response, next: NextFunction) {
    res.status(405).json({
      success: false,
      error: {
        code: 'method_not_allowed',
        message: `Method ${req.method} not allowed for ${req.originalUrl}`,
        allowedMethods: res.getHeader('Allow') || [],
      },
    });
  }

  /**
   * Handle 429 Too Many Requests
   */
  static tooManyRequests(req: Request, res: Response, next: NextFunction) {
    res.status(429).json({
      success: false,
      error: {
        code: 'too_many_requests',
        message: 'Too many requests, please try again later',
        retryAfter: res.getHeader('Retry-After') || 60,
      },
    });
  }

  /**
   * Handle 503 Service Unavailable
   */
  static serviceUnavailable(req: Request, res: Response, next: NextFunction) {
    res.status(503).json({
      success: false,
      error: {
        code: 'service_unavailable',
        message: 'Service temporarily unavailable',
        retryAfter: res.getHeader('Retry-After') || 300,
      },
    });
  }

  /**
   * Handle 502 Bad Gateway
   */
  static badGateway(req: Request, res: Response, next: NextFunction) {
    res.status(502).json({
      success: false,
      error: {
        code: 'bad_gateway',
        message: 'Bad gateway',
      },
    });
  }

  /**
   * Handle 504 Gateway Timeout
   */
  static gatewayTimeout(req: Request, res: Response, next: NextFunction) {
    res.status(504).json({
      success: false,
      error: {
        code: 'gateway_timeout',
        message: 'Gateway timeout',
      },
    });
  }

  /**
   * Handle 400 Bad Request
   */
  static badRequest(message = 'Bad request') {
    return (req: Request, res: Response, next: NextFunction) => {
      res.status(400).json({
        success: false,
        error: {
          code: 'bad_request',
          message,
        },
      });
    };
  }

  /**
   * Handle 401 Unauthorized
   */
  static unauthorized(message = 'Unauthorized') {
    return (req: Request, res: Response, next: NextFunction) => {
      res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message,
        },
      });
    };
  }

  /**
   * Handle 403 Forbidden
   */
  static forbidden(message = 'Forbidden') {
    return (req: Request, res: Response, next: NextFunction) => {
      res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message,
        },
      });
    };
  }

  /**
   * Handle 409 Conflict
   */
  static conflict(message = 'Conflict') {
    return (req: Request, res: Response, next: NextFunction) => {
      res.status(409).json({
        success: false,
        error: {
          code: 'conflict',
          message,
        },
      });
    };
  }

  /**
   * Handle 422 Unprocessable Entity
   */
  static unprocessableEntity(errors: any[] = []) {
    return (req: Request, res: Response, next: NextFunction) => {
      res.status(422).json({
        success: false,
        error: {
          code: 'unprocessable_entity',
          message: 'Validation failed',
          details: errors,
        },
      });
    };
  }

  /**
   * Handle 500 Internal Server Error
   */
  static internalServerError(message = 'Internal server error') {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
      logger.error('Internal server error:', {
        error: err.message,
        stack: err.stack,
        request: {
          method: req.method,
          url: req.originalUrl,
          params: req.params,
          query: req.query,
          body: req.body,
        },
      });

      const errorResponse = {
        success: false,
        error: {
          code: 'internal_server_error',
          message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
          ...(process.env.NODE_ENV !== 'production' && {
            stack: err.stack,
            details: err.details,
          }),
        },
      };

      res.status(500).json(errorResponse);
    };
  }
}
