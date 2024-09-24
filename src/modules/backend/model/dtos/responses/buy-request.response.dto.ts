import {SellOrderStatus} from "../../enums/sell-order-status.enum";

export interface BuyRequestResponseDto {
    temporaryWalletAddress: string;
    status: SellOrderStatus;
}