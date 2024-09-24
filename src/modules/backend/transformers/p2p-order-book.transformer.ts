import {SellRequestDto} from "../model/dtos/sell-request.dto";
import {SellOrderDm} from "../model/dms/sell-order.dm";
import {SellOrder} from "../model/schemas/sell-order.schema";
import {SellOrderStatus} from "../model/enums/sell-order-status.enum";
import {TemporaryWallet} from "../model/schemas/temporary-wallet.schema";
import {SellOrderResponseDto} from "../model/dtos/responses/sell-order.response.dto";
import {SellRequestResponseDto} from "../model/dtos/responses/sell-request.response.dto";

export class P2pOrderBookTransformer {

    static transformSellOrderDmToSellOrderDto(sellOrderDm: SellOrderDm): SellOrderResponseDto {
        return {
            orderId: sellOrderDm.id,
            quantity: sellOrderDm.quantity,
            ticker: sellOrderDm.ticker,
            atPrice: sellOrderDm.atPrice,
            status: sellOrderDm.status,
            createdAt: sellOrderDm.createdAt
        }
    }

    static transformSellRequestDtoToOrderDm(dto: SellRequestDto, id?: string): SellOrderDm {
        return {
            id,
            quantity: dto.quantity,
            ticker: dto.ticker,
            atPrice: dto.atPrice,
            sellerWalletAddress: dto.walletAddress
        }
    }

    static createSellOrder(sellOrderDm: SellOrderDm, temporaryWalletId: string): SellOrder {
        return {
            ticker: sellOrderDm.ticker,
            quantity: sellOrderDm.quantity,
            atPrice: sellOrderDm.atPrice,
            sellerWalletAddress: sellOrderDm.sellerWalletAddress,
            temporaryWalletId: temporaryWalletId,
            status: SellOrderStatus.WAITING_FOR_TOKENS
        }
    }

    static transformSellOrderModelToDm(sellOrder: SellOrder, temporaryWalletAddress: string): SellOrderDm {
        return {
            id: sellOrder._id.toString(),
            quantity: sellOrder.quantity,
            ticker: sellOrder.ticker,
            atPrice: sellOrder.atPrice,
            sellerWalletAddress: sellOrder.temporaryWalletId,
            tempMiddlemanWalletAddress: sellOrder.temporaryWalletId,
            status: sellOrder.status
        }
    }
}