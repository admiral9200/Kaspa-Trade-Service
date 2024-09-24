import {Injectable} from "@nestjs/common";
import {BaseRepository} from "./base.repository";
import {SellOrder} from "../model/schemas/sell-order.schema";
import {InjectModel} from "@nestjs/mongoose";
import {MONGO_DATABASE_CONNECTIONS} from "../constants";
import {Model} from "mongoose";
import {SellOrderStatus} from "../model/enums/sell-order-status.enum";

@Injectable()
export class SellOrdersBookRepository extends BaseRepository<SellOrder> {

    constructor(
        @InjectModel(SellOrder.name, MONGO_DATABASE_CONNECTIONS.P2P)
        private readonly sellOrdersModel: Model<SellOrder>) {
        super(sellOrdersModel);
    }

    async setWaitingForKasStatus(orderId: string): Promise<SellOrder> {
        return await super.updateByOne('_id', orderId, { status: SellOrderStatus.WAITING_FOR_KAS }, {status: SellOrderStatus.LISTED_FOR_SALE});
    }

    async setCheckoutStatus(orderId: string): Promise<SellOrder> {
        return await super.updateByOne('_id', orderId, { status: SellOrderStatus.CHECKOUT }, {status: SellOrderStatus.WAITING_FOR_KAS});
    }

    async updateStatusById(id: string, status: SellOrderStatus): Promise<SellOrder> {
        try {
            return await super.updateByOne('_id', id, { status });
        } catch (error) {
            console.error('Error updating sell order status by ID:', error);
            throw error;
        }
    }

    async getById(id: string): Promise<SellOrder> {
        try {
            return await super.findOneBy('_id', id);
        } catch (error) {
            console.error('Error getting sell order by ID:', error);
            throw error;
        }
    }

    async createSellOrder(sellOrder: SellOrder): Promise<SellOrder> {
        try {
            return await super.create(sellOrder);
        } catch (error) {
            console.error('Error creating sell order:', error);
            throw error;
        }
    }

    async getListedSellOrders(): Promise<SellOrder[]> {
        try {
            return await this.sellOrdersModel.find({ status: SellOrderStatus.LISTED_FOR_SALE }).exec();
        } catch (error) {
            console.log('Error getting sell orders', error);
            throw error;
        }
    }
}