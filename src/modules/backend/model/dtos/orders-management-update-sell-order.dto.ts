import { IsEnum, IsOptional } from 'class-validator';
import { SellOrderStatus } from '../enums/sell-order-status.enum';
import { SwapTransactionsResult } from '../../services/kaspa-network/interfaces/SwapTransactionsResult.interface';

export class OrdersManagementUpdateSellOrderDto {
  @IsEnum(SellOrderStatus)
  @IsOptional()
  status: SellOrderStatus;

  @IsOptional()
  transactions?: Partial<SwapTransactionsResult>;
}
