import { IsNumber, IsPositive, IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Input shape for a single line item. `lineTotal` is NOT accepted from the
 * client — it is computed server-side as qty * unitPrice (Section 4 notes).
 */
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
