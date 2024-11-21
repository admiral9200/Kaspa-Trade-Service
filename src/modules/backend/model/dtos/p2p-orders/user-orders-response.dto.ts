import { SellOrderStatusV2 } from '../../enums/sell-order-status-v2.enum';
import { SellOrderStatus } from '../../enums/sell-order-status.enum';

export interface UserOrderDto {
  orderId: string;
  pricePerToken: number;
  quantity: number;
  ticker: string;
  totalPrice: number;
  expiresAt: Date;
  createdAt: Date;
  sellerWalletAddress: string;
  buyerWalletAddress: string;
  status?: SellOrderStatus | SellOrderStatusV2;
  isDecentralized?: boolean;
}

export interface UserOrdersResponseDto {
  orders: UserOrderDto[];
  totalCount: number;
  allTickers: string[];
}
