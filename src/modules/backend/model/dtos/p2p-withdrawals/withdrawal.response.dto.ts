import { WithdrawalStatus } from "../../enums/withdrawal-status.enum";

export class WithdrawalResponseDto {
    success: boolean;
    amount: string;
    receivingWallet: string;
    status: WithdrawalStatus;
    createdAt: Date;
    updatedAt: Date;
}