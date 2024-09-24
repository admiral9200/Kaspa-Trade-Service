import {SellOrderStatus} from "../../enums/sell-order-status.enum";


export interface SellRequestResponseDto  {
    id: string;
    temporaryWalletAddress: string;
    status: SellOrderStatus;
}