import { SwapTransactionsResult } from '../../../../services/kaspa-network/interfaces/SwapTransactionsResult.interface';

export interface ConfirmBuyOrderRequestResponseDto {
  confirmed: boolean;
  transactions?: SwapTransactionsResult;
  priorityFeeTooHigh?: boolean;
}
