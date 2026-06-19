import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { mapPrismaError } from './prisma-exception.filter';

interface FailureEnvelope {
  success: false;
  message: string;
  errors: string[];
}

/**
 * Converts any thrown exception into the consistent failure envelope:
 *   { success: false, message, errors }
 *
 * - HttpException (incl. validation errors from ValidationPipe) is unwrapped so
 *   class-validator messages land in `errors[]`.
 * - Prisma known errors are mapped (same logic as the dedicated Prisma filter).
 * - Anything else becomes a 500 with a generic message.
 *
 * Every handled error is also printed to the terminal with the request context
 * (warn for 4xx, error + stack for 5xx).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] = [];
    let stack: string | undefined;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Reuse the exact mapping from the dedicated Prisma filter so behaviour is
      // identical regardless of which filter Nest happens to run first.
      const mapped = mapPrismaError(exception);
      status = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      message = mapped?.message ?? 'Database error';
      errors = mapped?.errors ?? [];
      if (!mapped) stack = exception.stack;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const res = body as Record<string, unknown>;
        const rawMessage = res.message;

        if (Array.isArray(rawMessage)) {
          // ValidationPipe default: message is an array of constraint strings.
          errors = rawMessage.map(String);
          message = 'Validation failed';
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }

        if (typeof res.error === 'string' && message === 'Internal server error') {
          message = res.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      stack = exception.stack;
    }

    // Print the error to the terminal with request context.
    const where = `${request.method} ${request.originalUrl}`;
    const detail = errors.length ? ` :: ${errors.join('; ')}` : '';
    if (status >= 500) {
      this.logger.error(`${where} -> ${status} ${message}${detail}`, stack);
    } else {
      this.logger.warn(`${where} -> ${status} ${message}${detail}`);
    }

    const payload: FailureEnvelope = { success: false, message, errors };
    response.status(status).json(payload);
  }
}
