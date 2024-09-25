import { SellOrderStatus } from '../enums/sell-order-status.enum';

export interface OrderDm {
  id?: string;
  walletSequenceId: number;
  quantity: number;
  ticker: string;
  pricePerToken: number;
  totalPrice: number;
  sellerWalletAddress: string;
  buyerWalletAddress?: string;
  status?: SellOrderStatus;
  expiresAt?: Date;
  createdAt?: Date;
}
