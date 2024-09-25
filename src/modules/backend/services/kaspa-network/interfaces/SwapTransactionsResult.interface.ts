export interface SwapTransactionsResult {
  readonly commitTransactionId: string;
  readonly revealTransactionId: string;
  readonly sellerTransactionId: string;
  readonly buyerTransactionId: string;
}
