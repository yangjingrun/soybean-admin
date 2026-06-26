import { Catch, HttpException, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ApiResponse } from '@soybean/shared';
import { createSystemLogErrorMetadata } from '../modules/system-log/system-log-error-taxonomy';
import type { SystemLogRecorder } from '../modules/system-log/system-log.types';
import { fail } from './api-response';

interface FastifyLikeReply {
  status(code: number): {
    send(body: ApiResponse<null>): unknown;
  };
}

interface FastifyLikeRequest {
  method?: string;
  url?: string;
  user?: {
    userId?: string;
    userName?: string;
  };
}

interface NestExceptionResponse {
  message?: string | string[];
  error?: string;
}

const INTERNAL_SERVER_ERROR_MESSAGE = 'Internal server error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter<unknown> {
  constructor(private readonly logRecorder?: Pick<SystemLogRecorder, 'record'>) {}

  /**
   * Format all thrown exceptions as the project ApiResponse envelope.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyLikeRequest>();
    const response = http.getResponse<FastifyLikeReply>();
    const status = getHttpStatus(exception);
    const code = getApiCode(status);
    const msg = getExceptionMessage(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      void this.recordUnhandledException(exception, request);
    }

    response.status(status).send(fail(code, msg, null));
  }

  /** Records unexpected API failures while keeping the client response generic. */
  private async recordUnhandledException(exception: unknown, request: FastifyLikeRequest) {
    if (!this.logRecorder) {
      return;
    }

    try {
      await this.logRecorder.record({
        level: 'error',
        status: 'failed',
        module: 'server',
        action: 'unhandled-exception',
        message: '后端接口出现未处理异常',
        userId: request.user?.userId,
        userName: request.user?.userName,
        errorMessage: exception instanceof Error ? exception.message : String(exception),
        metadata: createSystemLogErrorMetadata(exception, {
          method: request.method,
          url: request.url
        })
      });
    } catch {
      // 异常过滤器不能因为日志写入失败再次抛错。
    }
  }
}

/**
 * Resolve Nest HttpException status while keeping unknown errors as 500.
 */
function getHttpStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Map HTTP status to the frontend business code contract.
 */
function getApiCode(status: number): string {
  if (status === HttpStatus.UNAUTHORIZED) {
    return '8888';
  }

  return String(status);
}

/**
 * Extract a client-safe message from Nest exception response.
 */
function getExceptionMessage(exception: unknown): string {
  if (!(exception instanceof HttpException)) {
    return INTERNAL_SERVER_ERROR_MESSAGE;
  }

  const exceptionResponse = exception.getResponse();

  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  if (isNestExceptionResponse(exceptionResponse)) {
    const { message, error } = exceptionResponse;

    if (Array.isArray(message)) {
      return message.join('，');
    }

    if (typeof message === 'string') {
      return message;
    }

    if (typeof error === 'string') {
      return error;
    }
  }

  return exception.message || INTERNAL_SERVER_ERROR_MESSAGE;
}

function isNestExceptionResponse(value: unknown): value is NestExceptionResponse {
  return Boolean(value) && typeof value === 'object';
}
