import { OrderDm } from '../model/dms/order.dm';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { ListedOrderDto } from '../model/dtos/listed-order.dto';
import { OffMarketplaceRequestResponseDto } from '../model/dtos/responses/off-marketplace-request.response.dto';
import { OrderHistoryDm } from '../model/dms/order-history.dm';

export class P2pOrderBookResponseTransformer {
  static createSellOrderCreatedResponseDto(entity: P2pOrderEntity, temporaryWalletAddress: string): SellRequestResponseDto {
    return {
      id: entity._id,
      temporaryWalletAddress: temporaryWalletAddress,
      status: entity.status,
    };
  }

  static transformOrderDmToListedOrderDto(dm: OrderDm): ListedOrderDto {
    return {
      orderId: dm.id,
      pricePerToken: dm.pricePerToken,
      quantity: dm.quantity,
      ticker: dm.ticker,
      totalPrice: dm.totalPrice,
      expiresAt: dm.expiresAt,
      createdAt: dm.createdAt,
    };
  }

  static transformOrderEntityToListedOrderDto(entity: P2pOrderEntity): ListedOrderDto {
    return {
      orderId: entity._id,
      pricePerToken: entity.pricePerToken,
      quantity: entity.quantity,
      ticker: entity.ticker,
      totalPrice: entity.totalPrice,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
    };
  }

  static transformOrderEntityToDm(orderEntity: P2pOrderEntity): ListedOrderDto {
    return {
      orderId: orderEntity._id,
      pricePerToken: orderEntity.pricePerToken,
      quantity: orderEntity.quantity,
      ticker: orderEntity.ticker,
      totalPrice: orderEntity.totalPrice,
      expiresAt: orderEntity.expiresAt,
      createdAt: orderEntity.createdAt,
    };
  }

  static transformOrderDmToBuyResponseDto(orderDm: OrderDm, temporaryWalletAddress: string): BuyRequestResponseDto {
    return {
      success: true,
      temporaryWalletAddress: temporaryWalletAddress,
      status: orderDm.status,
    };
  }

  static transformOrderDmToOffMerketplaceResponseDto(orderDm: OrderDm): OffMarketplaceRequestResponseDto {
    return {
      success: true,
      status: orderDm.status,
    };
  }

  static transformToOrderHistoryOrder(order: P2pOrderEntity): OrderHistoryDm {
    return {
      orderId: order._id,
      pricePerToken: order.pricePerToken,
      quantity: order.quantity,
      ticker: order.ticker,
      totalPrice: order.totalPrice,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      status: order.status,
      sellerWalletAddress: order.sellerWalletAddress,
      buyerWalletAddress: order.buyerWalletAddress,
    };
  }
}
