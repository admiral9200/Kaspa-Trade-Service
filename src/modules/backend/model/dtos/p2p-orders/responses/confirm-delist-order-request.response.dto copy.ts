import { SwapTransactionsResult } from 'src/modules/backend/services/kaspa-network/interfaces/SwapTransactionsResult.interface';

export interface ConfirmDelistOrderRequestResponseDto {
  confirmed: boolean;
  transactions?: Partial<SwapTransactionsResult>;
  temporaryWalletAddress?: string;
  priorityFeeTooHigh?: boolean;
  needMoney?: boolean;
}
