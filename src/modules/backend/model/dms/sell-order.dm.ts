import { SellOrderStatus } from '../enums/sell-order-status.enum';

export interface SellOrderDm {
  id?: string;
  quantity: number;
  ticker: string;
  atPrice: number;
  totalPrice: number;
  sellerWalletAddress: string;
  buyerWalletAddress?: string;
  temporaryWalletAddress?: string;
  status?: SellOrderStatus;
  expiresAt?: Date;
  createdAt?: Date;
}
