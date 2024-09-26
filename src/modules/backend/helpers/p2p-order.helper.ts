import { Injectable } from '@nestjs/common';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';

@Injectable()
export class P2pOrderHelper {
  public static isOrderUnlistable(orderStatus: SellOrderStatus): boolean {
    return orderStatus === SellOrderStatus.LISTED_FOR_SALE;
  }
  public static isOrderCancelable(orderStatus: SellOrderStatus): boolean {
    return orderStatus === SellOrderStatus.WAITING_FOR_KAS;
  }
}
