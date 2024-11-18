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
    };
  }

  // static transformOrderEntityToListedOrderDto(entity: P2pOrderEntity): ListedOrderDto {
  //   return {
  //     orderId: entity._id,
  //     pricePerToken: entity.pricePerToken,
  //     quantity: entity.quantity,
  //     ticker: entity.ticker,
  //     totalPrice: entity.totalPrice,
  //     expiresAt: entity.expiresAt,
  //     createdAt: entity.createdAt,
  //   };
  // }

  // static transformOrderEntityToDm(orderEntity: P2pOrderEntity): ListedOrderDto {
  //   return {
  //     orderId: orderEntity._id,
  //     pricePerToken: orderEntity.pricePerToken,
  //     quantity: orderEntity.quantity,
  //     ticker: orderEntity.ticker,
  //     totalPrice: orderEntity.totalPrice,
  //     expiresAt: orderEntity.expiresAt,
  //     createdAt: orderEntity.createdAt,
  //   };
  // }

  // static transformOrderDmToBuyResponseDto(orderDm: OrderDm, temporaryWalletAddress: string): BuyRequestResponseDto {
  //   return {
  //     success: true,
  //     temporaryWalletAddress: temporaryWalletAddress,
  //     status: orderDm.status,
  //   };
  // }

  // static transformOrderDmToOffMerketplaceResponseDto(orderDm: OrderDm): OffMarketplaceRequestResponseDto {
  //   return {
  //     success: true,
  //     status: orderDm.status,
  //   };
  // }

  // static transformToOrderHistoryOrder(order: P2pOrderEntity): OrderHistoryDm {
  //   return {
  //     orderId: order._id,
  //     pricePerToken: order.pricePerToken,
  //     quantity: order.quantity,
  //     ticker: order.ticker,
  //     totalPrice: order.totalPrice,
  //     expiresAt: order.expiresAt,
  //     createdAt: order.createdAt,
  //     status: order.status,
  //     sellerWalletAddress: order.sellerWalletAddress,
  //     buyerWalletAddress: order.buyerWalletAddress,
  //   };
  // }
}
