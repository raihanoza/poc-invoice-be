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

// turn a known Prisma error into something HTTP-shaped. returns null for codes we
// don't handle specially, letting the catch-all 500 it. exported so the catch-all
// filter can reuse it and behave the same regardless of which filter Nest hits first.
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
