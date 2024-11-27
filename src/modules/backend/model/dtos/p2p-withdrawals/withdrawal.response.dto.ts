import { WithdrawalStatus } from "../../enums/withdrawal-status.enum";

export class WithdrawalResponseDto {
    amount: bigint;
    receivingWallet: string;
    status: WithdrawalStatus;
    createdAt: Date;
    updatedAt: Date;
}