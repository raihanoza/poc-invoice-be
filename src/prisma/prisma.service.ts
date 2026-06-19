import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient instance for the whole app, injected via Nest DI.
 * Do not instantiate PrismaClient anywhere else (Coding Standards, Section 11).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('PrismaService');

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (err) {
      // Don't crash the whole app on boot if the DB is unreachable — log and keep
      // serving. Requests that touch the DB will then fail per-request and be
      // logged by the global error filter, instead of preventing startup entirely.
      this.logger.error(
        `Database connection failed at startup: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
