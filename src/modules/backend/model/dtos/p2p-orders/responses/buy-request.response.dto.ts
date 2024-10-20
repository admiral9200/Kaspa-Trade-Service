import { SellOrderStatus } from '../../../enums/sell-order-status.enum';

export interface BuyRequestResponseDto {
  success: boolean;
  temporaryWalletAddress?: string;
  status?: SellOrderStatus;
}
