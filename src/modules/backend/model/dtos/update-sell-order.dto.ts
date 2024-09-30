import { IsNumber, Min } from 'class-validator';
import { MIN_TOTAL_PRICE } from '../schemas/p2p-order.schema';

export class UpdateSellOrderDto {
  @IsNumber()
  pricePerToken: number;

  @IsNumber()
  @Min(MIN_TOTAL_PRICE)
  totalPrice: number;
}
