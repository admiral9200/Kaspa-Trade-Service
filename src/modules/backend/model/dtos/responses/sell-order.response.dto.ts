import {SellOrderStatus} from "../../enums/sell-order-status.enum";

export interface SellOrderResponseDto {
    orderId: string;
    atPrice: number;
    quantity: number;
    ticker: string;
    status: SellOrderStatus;
    createdAt: Date;
}