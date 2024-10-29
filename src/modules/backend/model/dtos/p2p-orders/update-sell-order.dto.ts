import { IsInt, IsNumber, Min } from 'class-validator';
import { MIN_TOTAL_PRICE } from '../../schemas/p2p-order.schema';

export class UpdateSellOrderDto {
  @IsNumber()
  pricePerToken: number;

  @IsNumber()
  @IsInt()
  @Min(MIN_TOTAL_PRICE)
  totalPrice: number;
}
