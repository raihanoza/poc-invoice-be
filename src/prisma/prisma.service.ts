import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// one PrismaClient for the whole app, handed out through Nest DI.
// don't `new PrismaClient()` anywhere else.
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
      // if the DB is down at boot, don't take the whole app with it. just log it
      // and stay up — DB-backed requests will fail individually and get logged by
      // the global error filter.
      this.logger.error(
        `Database connection failed at startup: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
