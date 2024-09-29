import { SellOrderStatus } from '../enums/sell-order-status.enum';

export interface OrderHistoryDm {
  orderId: string;
  pricePerToken: number;
  quantity: number;
  ticker: string;
  totalPrice: number;
  expiresAt: Date;
  createdAt: Date;
  status: SellOrderStatus;
  sellerWalletAddress: string;
  buyerWalletAddress: string;
}
