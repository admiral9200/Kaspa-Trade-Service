import { SellOrderStatusV2 } from '../../../enums/sell-order-status-v2.enum';

export interface BuyRequestV2ResponseDto {
  success: boolean;
  status?: SellOrderStatusV2;
  psktSeller?: string;
}
