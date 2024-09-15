import {Injectable} from "@nestjs/common";
import {BaseRepository} from "./base.repository";
import {SellOrder} from "../model/schemas/sell-order.schema";
import {InjectModel} from "@nestjs/mongoose";
import {MONGO_DATABASE_CONNECTIONS} from "../constants";
import {Model} from "mongoose";
import {SellOrderDm} from "../model/dms/sell-order.dm";
import {P2pOrderBookTransformer} from "../transformers/p2p-order-book.transformer";
import {SellOrderStatus} from "../model/enums/sell-order-status.enum";

@Injectable()
export class SellOrdersBookRepository extends BaseRepository<SellOrder> {

    constructor(
        @InjectModel(SellOrder.name, MONGO_DATABASE_CONNECTIONS.P2P)
        private readonly sellOrdersModel: Model<SellOrder>) {
        super(sellOrdersModel);
    }

    async createSellOrder(sellOrderDm: SellOrderDm): Promise<SellOrder> {
        try {
            const sellOrder = P2pOrderBookTransformer.createSellOrder(sellOrderDm);
            sellOrder.status = SellOrderStatus.WAITING_FOR_FUNDS;

            return await super.create(sellOrder);
        } catch (error) {
            console.error('Error creating sell order:', error);
            throw error;
        }
    }
}