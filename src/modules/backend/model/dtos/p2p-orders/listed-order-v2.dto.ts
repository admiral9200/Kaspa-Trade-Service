import { SellOrderStatusV2 } from '../../enums/sell-order-status-v2.enum';

export interface ListedOrderV2Dto {
  orderId: string;
  pricePerToken: number;
  quantity: number;
  ticker: string;
  totalPrice: number;
  createdAt: Date;
  status: SellOrderStatusV2;
  psktSeller: string;
  psktTransactionId: string;
  sellerWalletAddress?: string;
  isDecentralized?: boolean;
}
