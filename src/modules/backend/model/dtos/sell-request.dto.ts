import { IsNumber, IsString, Min } from 'class-validator';

export class SellRequestDto {
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  ticker: string;

  @IsNumber()
  pricePerToken: number;

  @IsNumber()
  @Min(1)
  totalPrice: number;

  @IsString()
  walletAddress: string;
}
