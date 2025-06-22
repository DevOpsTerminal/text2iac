import { JsonController } from 'routing-controllers';
import { Service } from 'typedi';

export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

@Service()
@JsonController()
export abstract class BaseController {
  protected success<T>(data: T, meta?: any): IApiResponse<T> {
    return {
      success: true,
      data,
      ...(meta && { meta }),
    };
  }

  protected error(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): IApiResponse<null> {
    return {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    };
  }

  protected created<T>(data: T): IApiResponse<T> {
    return {
      success: true,
      data,
    };
  }

  protected notFound(message = 'Resource not found'): IApiResponse<null> {
    return this.error('not_found', message);
  }

  protected badRequest(message = 'Bad request', details?: Record<string, unknown>): IApiResponse<null> {
    return this.error('bad_request', message, details);
  }

  protected unauthorized(message = 'Unauthorized'): IApiResponse<null> {
    return this.error('unauthorized', message);
  }

  protected forbidden(message = 'Forbidden'): IApiResponse<null> {
    return this.error('forbidden', message);
  }

  protected internalError(message = 'Internal server error'): IApiResponse<null> {
    return this.error('internal_error', message);
  }
}
