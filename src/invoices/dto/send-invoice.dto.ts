import { ReminderChannel } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

// lets the "Send to client" button override the channel. leave it off and we
// just use whatever reminderChannel the client is set to.
export class SendInvoiceDto {
  @IsOptional()
  @IsEnum(ReminderChannel, {
    message: 'channel must be one of: email, whatsapp, both',
  })
  channel?: ReminderChannel;
}
