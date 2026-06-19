import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// marked global so any module can inject PrismaService without importing this again
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
