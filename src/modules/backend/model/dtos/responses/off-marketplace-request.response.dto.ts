import { SellOrderStatus } from '../../enums/sell-order-status.enum';

export interface OffMarketplaceRequestResponseDto {
  success: boolean;
  temporaryWalletAddress?: string;
  status?: SellOrderStatus;
}
