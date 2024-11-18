import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SellOrderV2Dto {
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  ticker: string;

  @IsNumber()
  pricePerToken: number;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsString()
  psktSeller: string;

  @IsString()
  psktTransactionId: string;
}
