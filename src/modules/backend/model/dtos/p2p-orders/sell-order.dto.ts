import { IsInt, IsNumber, IsString, Min } from 'class-validator';
import { MIN_TOKEN_AMOUNT, MIN_TOTAL_PRICE } from '../../schemas/p2p-order.schema';

export class SellOrderDto {
  @IsNumber()
  @IsInt()
  @Min(MIN_TOKEN_AMOUNT)
  quantity: number;

  @IsString()
  ticker: string;

  @IsNumber()
  pricePerToken: number;

  @IsNumber()
  @IsInt()
  @Min(MIN_TOTAL_PRICE)
  totalPrice: number;
}
