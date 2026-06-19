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

// create an invoice plus its line items in a single request.
// for the client, send either clientId (existing) or client (create a new one inline),
// but not both. the service checks that so it can return a readable error.
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
