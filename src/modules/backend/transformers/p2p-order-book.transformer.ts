import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { SellOrderDm } from '../model/dms/sell-order.dm';
import { P2pOrder } from '../model/schemas/p2p-order.schema';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { TemporaryWallet } from '../model/schemas/temporary-wallet.schema';
import { SellOrderResponseDto } from '../model/dtos/responses/sell-order.response.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';

export class P2pOrderBookTransformer {
  static transformSellOrderDmToSellOrderDto(sellOrderDm: SellOrderDm): SellOrderResponseDto {
    return {
      orderId: sellOrderDm.id,
      quantity: sellOrderDm.quantity,
      ticker: sellOrderDm.ticker,
      atPrice: sellOrderDm.atPrice,
      status: sellOrderDm.status,
      expiresAt: sellOrderDm.expiresAt,
      createdAt: sellOrderDm.createdAt,
    };
  }

  static transformSellRequestDtoToOrderDm(dto: SellRequestDto, id?: string): SellOrderDm {
    return {
      id,
      quantity: dto.quantity,
      ticker: dto.ticker,
      atPrice: dto.atPrice,
      totalPrice: dto.totalPrice,
      sellerWalletAddress: dto.walletAddress,
    };
  }

  static createSellOrder(sellOrderDm: SellOrderDm, walletSequenceId: number): P2pOrder {
    return {
      ticker: sellOrderDm.ticker,
      quantity: sellOrderDm.quantity,
      atPrice: sellOrderDm.atPrice,
      totalPrice: sellOrderDm.totalPrice,
      sellerWalletAddress: sellOrderDm.sellerWalletAddress,
      walletSequenceId: walletSequenceId,
      status: SellOrderStatus.WAITING_FOR_TOKENS,
    };
  }

  static transformSellOrderModelToDm(sellOrder: P2pOrder, temporaryWalletAddress: string): SellOrderDm {
    return {
      id: sellOrder._id.toString(),
      quantity: sellOrder.quantity,
      ticker: sellOrder.ticker,
      atPrice: sellOrder.atPrice,
      totalPrice: sellOrder.totalPrice,
      sellerWalletAddress: sellOrder.sellerWalletAddress,
      temporaryWalletAddress: temporaryWalletAddress,
      status: sellOrder.status,
    };
  }
}
