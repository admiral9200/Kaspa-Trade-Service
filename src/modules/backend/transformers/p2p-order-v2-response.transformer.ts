import { P2pOrderV2Entity } from '../model/schemas/p2p-order-v2.schema';
import { SellRequestV2ResponseDto } from '../model/dtos/p2p-orders/responses/sell-request-v2.response.dto';
import { ListedOrderV2Dto } from '../model/dtos/p2p-orders/listed-order-v2.dto';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { UserOrderDto } from '../model/dtos/p2p-orders/user-orders-response.dto';

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
    };
  }

  static transformToUserOrderOrder(order: P2pOrderEntity | P2pOrderV2Entity): UserOrderDto {
    return {
      orderId: order._id,
      pricePerToken: order.pricePerToken,
      quantity: order.quantity,
      ticker: order.ticker,
      totalPrice: order.totalPrice,
      expiresAt: (order as P2pOrderEntity).expiresAt || null,
      createdAt: order.createdAt,
      status: order.status,
      sellerWalletAddress: order.sellerWalletAddress,
      buyerWalletAddress: order.buyerWalletAddress,
      isDecentralized: (order as any).isDecentralized,
    };
  }
}
