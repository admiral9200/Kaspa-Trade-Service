import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { OrderDm } from '../model/dms/order.dm';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { SellOrderResponseDto } from '../model/dtos/responses/sell-order.response.dto';
import { ListedOrderDto } from '../model/dtos/listed-order.dto';

export class P2pOrderBookTransformer {
  static transformP2pOrderEntityToListedOrderDto(entity: P2pOrderEntity): ListedOrderDto {
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

  static transformSellOrderDmToSellOrderDto(sellOrderDm: OrderDm): SellOrderResponseDto {
    return {
      orderId: sellOrderDm.id,
      quantity: sellOrderDm.quantity,
      ticker: sellOrderDm.ticker,
      pricePerToken: sellOrderDm.pricePerToken,
      status: sellOrderDm.status,
      expiresAt: sellOrderDm.expiresAt,
      createdAt: sellOrderDm.createdAt,
      totalPrice: sellOrderDm.totalPrice,
    };
  }

  static createP2pOrderEntityFromSellOrderDto(sellOrderDto: SellOrderDto, walletSequenceId: number): P2pOrderEntity {
    return {
      ticker: sellOrderDto.ticker,
      quantity: sellOrderDto.quantity,
      pricePerToken: sellOrderDto.pricePerToken,
      totalPrice: sellOrderDto.totalPrice,
      sellerWalletAddress: sellOrderDto.walletAddress,
      walletSequenceId: walletSequenceId,
      status: SellOrderStatus.WAITING_FOR_TOKENS,
    };
  }

  static transformP2pOrderEntityToDm(sellOrder: P2pOrderEntity): OrderDm {
    return {
      id: sellOrder._id,
      walletSequenceId: sellOrder.walletSequenceId,
      quantity: sellOrder.quantity,
      ticker: sellOrder.ticker,
      pricePerToken: sellOrder.pricePerToken,
      totalPrice: sellOrder.totalPrice,
      sellerWalletAddress: sellOrder.sellerWalletAddress,
      buyerWalletAddress: sellOrder.buyerWalletAddress,
      status: sellOrder.status,
      expiresAt: sellOrder.expiresAt,
      createdAt: sellOrder.createdAt,
    };
  }
}
