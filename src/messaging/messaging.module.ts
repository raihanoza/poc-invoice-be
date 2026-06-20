import { Module } from '@nestjs/common';
import { PdfModule } from '../pdf/pdf.module';
import { EmailService } from './email.service';
import { GroqService } from './groq.service';
import { MessagingService } from './messaging.service';
import { ReminderDispatchService } from './reminder-dispatch.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [PdfModule],
  providers: [
    MessagingService,
    EmailService,
    WhatsappService,
    GroqService,
    ReminderDispatchService,
  ],
  exports: [MessagingService, ReminderDispatchService],
})
export class MessagingModule {}
