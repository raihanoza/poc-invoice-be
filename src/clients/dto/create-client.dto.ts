import { ReminderChannel } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+()\-\s]{6,20}$/, {
    message: 'whatsappNumber must be a valid phone number',
  })
  whatsappNumber?: string;

  @IsOptional()
  @IsEnum(ReminderChannel, {
    message: 'reminderChannel must be one of: email, whatsapp, both',
  })
  reminderChannel?: ReminderChannel;
}
