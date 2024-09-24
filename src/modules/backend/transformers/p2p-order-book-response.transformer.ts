import { SellOrderDm } from '../model/dms/sell-order.dm';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';

export class P2pOrderBookResponseTransformer {
  static transformDmToSellResponseDto(sellOrderDm: SellOrderDm): SellRequestResponseDto {
    return {
      id: sellOrderDm.id,
      temporaryWalletAddress: sellOrderDm.sellerWalletAddress,
      status: sellOrderDm.status,
    };
  }

  static transformDmToBuyResponseDto(sellOrderDm: SellOrderDm): BuyRequestResponseDto {
    return {
      temporaryWalletAddress: sellOrderDm.temporaryWalletAddress,
      status: sellOrderDm.status,
    };
  }
}
