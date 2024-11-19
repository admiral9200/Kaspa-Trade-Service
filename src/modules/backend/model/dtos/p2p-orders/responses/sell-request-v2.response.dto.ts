import { SellOrderStatusV2 } from '../../../enums/sell-order-status-v2.enum';

export interface SellRequestV2ResponseDto {
  id: string;
  status: SellOrderStatusV2;
}
