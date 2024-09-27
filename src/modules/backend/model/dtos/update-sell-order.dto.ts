import { IsNumber, IsString, Min } from 'class-validator';

export class UpdateSellOrderDto {
  @IsNumber()
  pricePerToken: number;

  @IsNumber()
  @Min(1)
  totalPrice: number;

  @IsString()
  walletAddress: string;
}
