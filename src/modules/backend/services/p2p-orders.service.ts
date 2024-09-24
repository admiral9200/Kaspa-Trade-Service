import {HttpException, HttpStatus, Injectable} from "@nestjs/common";
import {SellOrderDm} from "../model/dms/sell-order.dm";
import {SellOrdersBookRepository} from "../repositories/sell-orders-book.repository";
import {SellOrder} from "../model/schemas/sell-order.schema";
import {P2pOrderBookTransformer} from "../transformers/p2p-order-book.transformer";
import {WasmFacade} from "../facades/wasm.facade";
import {TemporaryWallet} from "../model/schemas/temporary-wallet.schema";
import {P2pTemporaryWalletsRepository} from "../repositories/p2p-temporary-wallets.repository";
import {SellOrderStatus} from "../model/enums/sell-order-status.enum";

@Injectable()
export class P2pOrdersService {

    constructor (
        private readonly wasmFacade: WasmFacade,
        private readonly p2pTemporaryWalletsRepository: P2pTemporaryWalletsRepository,
        private readonly sellOrdersBookRepository: SellOrdersBookRepository){}

    public async getSellOrders(): Promise<SellOrderDm[]> {
        return await this.sellOrdersBookRepository.getListedSellOrders();
    }

    public async createSell(sellOrderDm: SellOrderDm) {
        try {
            const temporaryWalletAddress: string = await this.wasmFacade.createWalletAccount();

            const temporaryWallet: TemporaryWallet = await this.p2pTemporaryWalletsRepository.createTemporaryWallet(temporaryWalletAddress);

            const sellOrder: SellOrder = P2pOrderBookTransformer.createSellOrder(sellOrderDm, temporaryWallet._id);
            const createdSellOrder = await this.sellOrdersBookRepository.createSellOrder(sellOrder);

            return P2pOrderBookTransformer.transformSellOrderModelToDm(createdSellOrder, temporaryWallet.address);
        } catch (err) {
            throw new HttpException('Failed to create a new sell order', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public async assignBuyerToOrder(orderId: string): Promise<SellOrderDm> {
        const sellOrder: SellOrder = await this.sellOrdersBookRepository.setWaitingForKasStatus(orderId);
        if (!sellOrder) {
            throw new HttpException('Failed assigning buyer, already in progress', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const temporaryWallet: TemporaryWallet = await this.p2pTemporaryWalletsRepository.findOneBy('_id', sellOrder.temporaryWalletId);
        if (!temporaryWallet) {
            throw new HttpException(`Temporary wallet not found wallet ID(${ sellOrder.temporaryWalletId})`, HttpStatus.NOT_FOUND);
        }

        return P2pOrderBookTransformer.transformSellOrderModelToDm(sellOrder, temporaryWallet.address);
    }

    public async confirmAndValidateSellOrderListing(sellOrderId: string): Promise<boolean> {
        const order: SellOrder = await this.sellOrdersBookRepository.getById(sellOrderId);
        if (!order) {
            throw new HttpException('Sell order not found', HttpStatus.NOT_FOUND);
        }


        // Todo use WASM facade to validate


        // FROM HERE MEANS VALIDATION PASSED

        await this.sellOrdersBookRepository.updateStatusById(order._id, SellOrderStatus.LISTED_FOR_SALE);

        return true;
    }

    async confirmBuy(sellOrderId: string) {
        // Validate that the buyer has sent the KAS to the temporary wallet TODO

        // FROM HERE, MEANS VALIDATION PASSED
        const order: SellOrder = await this.sellOrdersBookRepository.setCheckoutStatus(sellOrderId);
        if (!order) {
            throw new HttpException('Sell order is not in the matching status, cannot confirm buy.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return true;
    }
}