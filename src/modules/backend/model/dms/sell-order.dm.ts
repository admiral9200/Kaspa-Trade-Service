import {SellOrderStatus} from "../enums/sell-order-status.enum";

export interface SellOrderDm {
    id?: string;
    quantity: number;
    token: string;
    atPrice: number;
    walletAddress: string;
    tempMiddlemanWalletAddress?: string;
    status?: SellOrderStatus;
    createdAt?: Date;
}