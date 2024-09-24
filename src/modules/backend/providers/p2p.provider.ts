import {Injectable} from "@nestjs/common";
import {SellRequestDto} from "../model/dtos/sell-request.dto";
import {P2pOrdersService} from "../services/p2p-orders.service";
import {P2pOrderBookTransformer} from "../transformers/p2p-order-book.transformer";
import {SellOrderDm} from "../model/dms/sell-order.dm";
import {P2pOrderBookResponseTransformer} from "../transformers/p2p-order-book-response.transformer";
import {ConfirmSellOrderRequestResponseDto} from "../model/dtos/responses/confirm-sell-order-request.response.dto";
import {BuyRequestResponseDto} from "../model/dtos/responses/buy-request.response.dto";
import {SellRequestResponseDto} from "../model/dtos/responses/sell-request.response.dto";
import {ConfirmBuyOrderRequestResponseDto} from "../model/dtos/responses/confirm-buy-order-request.response.dto";
import {SellOrderResponseDto} from "../model/dtos/responses/sell-order.response.dto";
import {BuyRequestDto} from "../model/dtos/buy-request.dto";

@Injectable()
export class P2pProvider {
    constructor(
        private readonly p2pOrderBookService: P2pOrdersService,
    ) {}

    public async listSellOrders(): Promise<SellOrderResponseDto[]> {
        const orders: SellOrderDm[] = await this.p2pOrderBookService.getSellOrders();
        return orders.map(order => P2pOrderBookTransformer.transformSellOrderDmToSellOrderDto(order));
    }

    public async createSellOrder(dto: SellRequestDto): Promise<SellRequestResponseDto> {
        const sellOrderDm = P2pOrderBookTransformer.transformSellRequestDtoToOrderDm(dto);

        const createdSellOrderDm: SellOrderDm = await this.p2pOrderBookService.createSell(sellOrderDm);

        return P2pOrderBookResponseTransformer.transformDmToSellResponseDto(createdSellOrderDm);
    }

    public async buy(orderId: string, buyRequestDto: BuyRequestDto): Promise<BuyRequestResponseDto> {
        const sellOrderDm: SellOrderDm = await this.p2pOrderBookService.assignBuyerToOrder(orderId, buyRequestDto.walletAddress);
        return P2pOrderBookResponseTransformer.transformDmToBuyResponseDto(sellOrderDm);
    }

    public async confirmAndValidateSellOrderListing(sellOrderId: string): Promise<ConfirmSellOrderRequestResponseDto> {
        const confirmed: boolean = await this.p2pOrderBookService.confirmAndValidateSellOrderListing(sellOrderId);
        return {
            confirmed
        }
    }

    public async confirmBuy(sellOrderId: string): Promise<ConfirmBuyOrderRequestResponseDto> {
        const confirmed: boolean = await this.p2pOrderBookService.confirmBuy(sellOrderId);

        // PERFORM SWAP TODO

        return {
            confirmed,
        };
    }
}