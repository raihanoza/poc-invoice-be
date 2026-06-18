import { ReminderChannel } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Optional channel override for the manual "Send to client" action. When
 * omitted, the client's own `reminderChannel` preference is used.
 */
export class SendInvoiceDto {
  @IsOptional()
  @IsEnum(ReminderChannel, {
    message: 'channel must be one of: email, whatsapp, both',
  })
  channel?: ReminderChannel;
}
