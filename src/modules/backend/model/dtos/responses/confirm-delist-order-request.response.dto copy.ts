import { CancelSwapTransactionsResult } from 'src/modules/backend/services/kaspa-network/interfaces/CancelSwapTransactionsResult.interface';

export interface ConfirmDelistOrderRequestResponseDto {
  confirmed: boolean;
  transactions?: CancelSwapTransactionsResult;
  priorityFeeTooHigh?: boolean;
}
