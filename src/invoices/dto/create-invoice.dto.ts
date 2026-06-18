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
import { CreateClientDto } from '../../clients/dto/create-client.dto';
import { InvoiceItemInputDto } from './invoice-item.dto';

/**
 * Create an invoice with its line items in one request.
 *
 * Client selection (Section 5.1): provide EITHER `clientId` (existing client)
 * OR `client` (inline-create a new client) — exactly one. The "exactly one"
 * rule is enforced in the service so we can return a clear message.
 */
export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientDto)
  client?: CreateClientDto;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsNotEmpty()
  invoiceNo?: string;

  @IsDateString({}, { message: 'createdDate must be a valid date (YYYY-MM-DD)' })
  createdDate!: string;

  @IsDateString({}, { message: 'dueDate must be a valid date (YYYY-MM-DD)' })
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'an invoice needs at least 1 line item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items!: InvoiceItemInputDto[];
}
