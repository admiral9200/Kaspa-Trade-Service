import { SellOrderStatus } from '../enums/sell-order-status.enum';
import { SwapTransactionsResult } from '../../services/kaspa-network/interfaces/SwapTransactionsResult.interface';

export interface GetOrderStatusResponseDto {
  status: SellOrderStatus;
  transactionsData?: Partial<SwapTransactionsResult>;
}
