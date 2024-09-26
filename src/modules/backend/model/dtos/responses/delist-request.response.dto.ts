import { SellOrderStatus } from '../../enums/sell-order-status.enum';

export interface DelistRequestResponseDto {
  temporaryWalletAddress: string;
  status: SellOrderStatus;
}
