import {Injectable} from "@nestjs/common";
import {BaseRepository} from "./base.repository";
import {SellOrder} from "../model/schemas/sell-order.schema";
import {InjectModel} from "@nestjs/mongoose";
import {MONGO_DATABASE_CONNECTIONS} from "../constants";
import {Model} from "mongoose";
import {TemporaryWallet} from "../model/schemas/temporary-wallet.schema";

@Injectable()
export class P2pTemporaryWalletsRepository extends BaseRepository<TemporaryWallet> {

    constructor(
        @InjectModel(TemporaryWallet.name, MONGO_DATABASE_CONNECTIONS.P2P)
        private readonly temporaryWalletModel: Model<TemporaryWallet>) {
        super(temporaryWalletModel);
    }

    async createTemporaryWallet(address: string): Promise<TemporaryWallet> {
        try {
            return await super.create({
                address,
                isInUse: true,
            });
        } catch (error) {
            console.error('Error creating temporary wallet:', error);
            throw error;
        }
    }
}