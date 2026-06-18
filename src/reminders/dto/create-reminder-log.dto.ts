import { ReminderChannel, ReminderLogStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateReminderLogDto {
  @IsUUID()
  invoiceId!: string;

  @IsEnum(ReminderChannel, {
    message: 'channel must be one of: email, whatsapp, both',
  })
  channel!: ReminderChannel;

  @IsString()
  @IsNotEmpty()
  messageContent!: string;

  @IsEnum(ReminderLogStatus, { message: 'status must be one of: sent, failed' })
  status!: ReminderLogStatus;

  /** Defaults to today (UTC) when omitted. Drives the per-day idempotency. */
  @IsOptional()
  @IsDateString({}, { message: 'sentDate must be a valid date (YYYY-MM-DD)' })
  sentDate?: string;
}
