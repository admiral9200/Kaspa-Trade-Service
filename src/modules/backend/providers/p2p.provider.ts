import {Injectable} from "@nestjs/common";
import {SellRequestDto} from "../model/dtos/sell-request.dto";
import {P2pOrdersService} from "../services/p2p-orders.service";
import {P2pOrderBookTransformer} from "../transformers/p2p-order-book.transformer";

@Injectable()
export class P2pProvider {
    constructor(
        private readonly p2pOrderBookService: P2pOrdersService,
    ) {}

    public async createSellOrder(dto: SellRequestDto) {
        const sellOrderDm = P2pOrderBookTransformer.transformSellRequestDtoToOrderDm(dto);
        await this.p2pOrderBookService.createSell(sellOrderDm);
        // todo create wallet
    }
}