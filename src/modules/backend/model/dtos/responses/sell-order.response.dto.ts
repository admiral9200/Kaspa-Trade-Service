import {SellOrderStatus} from "../../enums/sell-order-status.enum";

export interface SellOrderResponseDto {
    id: string;
    atPrice: number;
    quantity: number;
    token: string;
    status: SellOrderStatus;
    createdAt: Date;
}