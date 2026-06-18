import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

interface FailureEnvelope {
  success: false;
  message: string;
  errors: string[];
}

export interface MappedPrismaError {
  status: number;
  message: string;
  errors: string[];
}

/**
 * Translate a known Prisma error into an HTTP-shaped result.
 * Returns null for codes we don't special-case (let the catch-all 500 it).
 *
 * Exported so the catch-all HttpExceptionFilter can reuse the exact same
 * mapping — this keeps behaviour identical no matter which filter Nest runs
 * first, removing any dependency on global-filter ordering.
 */
export function mapPrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
): MappedPrismaError | null {
  switch (exception.code) {
    case 'P2002': {
      const target = (exception.meta?.target as string[] | string | undefined) ?? '';
      const fields = Array.isArray(target) ? target.join(', ') : String(target);
      return {
        status: HttpStatus.CONFLICT,
        message: fields
          ? `A record with this ${fields} already exists`
          : 'Unique constraint violation',
        errors: fields ? [`Duplicate value for: ${fields}`] : [],
      };
    }
    case 'P2025': {
      const cause = (exception.meta?.cause as string | undefined) ?? 'Record not found';
      return {
        status: HttpStatus.NOT_FOUND,
        message: cause,
        errors: [],
      };
    }
    case 'P2003': {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Related record does not exist (foreign key constraint failed)',
        errors: [],
      };
    }
    default:
      return null;
  }
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const mapped = mapPrismaError(exception);
    const status = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const payload: FailureEnvelope = {
      success: false,
      message: mapped?.message ?? 'Database error',
      errors: mapped?.errors ?? [],
    };

    response.status(status).json(payload);
  }
}
