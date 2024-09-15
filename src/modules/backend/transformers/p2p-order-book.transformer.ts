import {SellRequestDto} from "../model/dtos/sell-request.dto";
import {SellOrderDm} from "../model/dms/sell-order.dm";
import {SellOrder} from "../model/schemas/sell-order.schema";
import {SellOrderStatus} from "../model/enums/sell-order-status.enum";

export class P2pOrderBookTransformer {
    static transformSellRequestDtoToOrderDm(dto: SellRequestDto, id?: string): SellOrderDm {
        return {
            id,
            quantity: dto.quantity,
            token: dto.token,
            atPrice: dto.atPrice,
            walletAddress: dto.walletAddress
        }
    }

    static createSellOrder(sellOrderDm: SellOrderDm): SellOrder {
        return {
            token: sellOrderDm.token,
            quantity: sellOrderDm.quantity,
            atPrice: sellOrderDm.atPrice,
            walletAddress: sellOrderDm.walletAddress,
        }
    }
}