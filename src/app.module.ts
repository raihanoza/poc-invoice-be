import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ClientsModule } from './clients/clients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PdfModule } from './pdf/pdf.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ClientsModule,
    InvoicesModule,
    PdfModule,
    RemindersModule,
  ],
})
export class AppModule {}
