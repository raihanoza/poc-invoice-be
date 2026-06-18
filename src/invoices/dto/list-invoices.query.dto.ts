import { InvoiceStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus, { message: 'status must be one of: unpaid, paid' })
  status?: InvoiceStatus;
}
