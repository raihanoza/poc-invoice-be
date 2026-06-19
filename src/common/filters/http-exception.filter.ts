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

// Turns whatever gets thrown into one shape: { success: false, message, errors }.
// HttpExceptions (including ValidationPipe errors) get unwrapped so class-validator
// messages end up in errors[]. Known Prisma errors go through the same mapping the
// Prisma filter uses. Everything else is a generic 500. Each one is logged with the
// request too — warn for 4xx, error + stack for 5xx.
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
      // borrow the same mapping the Prisma filter uses, so we behave the same
      // no matter which filter Nest reaches for first
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
          // ValidationPipe hands us an array of constraint messages
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

    // log it out with the request that caused it
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
