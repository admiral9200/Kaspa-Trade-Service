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
            id: sellOrderDm.id,
            quantity: sellOrderDm.quantity,
            token: sellOrderDm.token,
            atPrice: sellOrderDm.atPrice,
            status: sellOrderDm.status,
            createdAt: sellOrderDm.createdAt
        }
    }

    static transformSellRequestDtoToOrderDm(dto: SellRequestDto, id?: string): SellOrderDm {
        return {
            id,
            quantity: dto.quantity,
            token: dto.token,
            atPrice: dto.atPrice,
            walletAddress: dto.walletAddress
        }
    }

    static createSellOrder(sellOrderDm: SellOrderDm, temporaryWalletId: string): SellOrder {
        return {
            token: sellOrderDm.token,
            quantity: sellOrderDm.quantity,
            atPrice: sellOrderDm.atPrice,
            walletAddress: sellOrderDm.walletAddress,
            temporaryWalletId: temporaryWalletId,
            status: SellOrderStatus.WAITING_FOR_TOKENS
        }
    }

    static transformSellOrderModelToDm(sellOrder: SellOrder, temporaryWalletAddress: string): SellOrderDm {
        return {
            id: sellOrder._id.toString(),
            quantity: sellOrder.quantity,
            token: sellOrder.token,
            atPrice: sellOrder.atPrice,
            walletAddress: sellOrder.temporaryWalletId,
            tempMiddlemanWalletAddress: sellOrder.temporaryWalletId,
            status: sellOrder.status
        }
    }
}