import { WithdrawalStatus } from "../../enums/withdrawal-status.enum";

export interface ListedWithdrawalDto {
    withdrawalId: string;
    amount: number;
    ownerWallet: string;
    receivingWallet: string;
    createdAt: Date;
    updatedAt: Date;
    status?: WithdrawalStatus;
  }
  