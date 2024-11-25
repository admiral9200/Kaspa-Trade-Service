import { WithdrawalStatus } from "../../enums/withdrawal-status.enum";

export class WithdrawalResponseDto {
    id: string;
    amount: number;
    ownerWallet: string;
    receivingWallet: string;
    status: WithdrawalStatus;
    createdAt: Date;
    updatedAt: Date;
}