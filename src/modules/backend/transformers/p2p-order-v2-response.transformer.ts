import { P2pOrderV2Entity } from '../model/schemas/p2p-order-v2.schema';
import { SellRequestV2ResponseDto } from '../model/dtos/p2p-orders/responses/sell-request-v2.response.dto';
import { ListedOrderV2Dto } from '../model/dtos/p2p-orders/listed-order-v2.dto';

export class P2pOrderV2ResponseTransformer {
  static createSellOrderCreatedResponseDto(entity: P2pOrderV2Entity): SellRequestV2ResponseDto {
    return {
      id: entity._id,
      status: entity.status,
    };
  }

  static transformOrderToListedOrderDto(entity: P2pOrderV2Entity): ListedOrderV2Dto {
    return {
      orderId: entity._id,
      pricePerToken: entity.pricePerToken,
      quantity: entity.quantity,
      ticker: entity.ticker,
      totalPrice: entity.totalPrice,
      createdAt: entity.createdAt,
      psktSeller: entity.psktSeller,
      psktTransactionId: entity.psktTransactionId,
      status: entity.status,
      sellerWalletAddress: entity.sellerWalletAddress,
      isDecentralized: true,
    };
  }
}
