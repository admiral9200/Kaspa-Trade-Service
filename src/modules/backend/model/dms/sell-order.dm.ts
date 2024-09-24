import {SellOrderStatus} from "../enums/sell-order-status.enum";

export interface SellOrderDm {
    id?: string;
    quantity: number;
    ticker: string;
    atPrice: number;
    sellerWalletAddress: string;
    buyerWalletAddress?: string;
    tempMiddlemanWalletAddress?: string;
    status?: SellOrderStatus;
    createdAt?: Date;
}