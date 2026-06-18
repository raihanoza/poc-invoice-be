import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceItemInputDto } from './invoice-item.dto';

/**
 * Update invoice fields and/or replace its line items. When `items` is present
 * it REPLACES the full set (and grandTotal is recomputed). Status is changed
 * via the dedicated mark-as-paid endpoint, not here.
 */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsNotEmpty()
  invoiceNo?: string;

  @IsOptional()
  @IsDateString({}, { message: 'createdDate must be a valid date (YYYY-MM-DD)' })
  createdDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dueDate must be a valid date (YYYY-MM-DD)' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'an invoice needs at least 1 line item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items?: InvoiceItemInputDto[];
}
