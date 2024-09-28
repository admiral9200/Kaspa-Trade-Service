import { SwapTransactionsResult } from '../interfaces/SwapTransactionsResult.interface';
import { PriorityFeeTooHighError } from './PriorityFeeTooHighError';

export class SwapPriorityFeeTooHighError extends PriorityFeeTooHighError {
  constructor(public transactions: Partial<SwapTransactionsResult>) {
    super();
    this.name = 'PriorityFeeTooHighError';
  }
}
