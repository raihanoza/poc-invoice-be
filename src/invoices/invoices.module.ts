import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { PdfModule } from '../pdf/pdf.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PublicInvoicesController } from './public-invoices.controller';

@Module({
  imports: [PdfModule, MessagingModule],
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
