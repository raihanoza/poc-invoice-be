import { IsNumber, IsPositive, IsString, IsNotEmpty, MaxLength } from 'class-validator';

// one line item as it comes in. note we don't take lineTotal from the client —
// it's worked out on the server as qty * unitPrice.
export class InvoiceItemInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'qty must be a number with up to 2 decimals' })
  @IsPositive({ message: 'qty must be greater than 0' })
  qty!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'unitPrice must be a number with up to 2 decimals' })
  @IsPositive({ message: 'unitPrice must be greater than 0' })
  unitPrice!: number;
}
