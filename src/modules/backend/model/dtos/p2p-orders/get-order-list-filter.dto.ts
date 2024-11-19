import { SellOrderStatusV2 } from '../../enums/sell-order-status-v2.enum';
import { SellOrderStatus } from '../../enums/sell-order-status.enum';

export class GetOrderListFiltersDto {
  statuses?: (SellOrderStatus | SellOrderStatusV2)[];
  tickers?: string[];
  sellerWalletAddress?: string;
  buyerWalletAddress?: string;
  totalPrice?: {
    min?: number;
    max?: number;
  };
  startDateTimestamp?: number;
  endDateTimestamp?: number;
}
