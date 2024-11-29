export class InvalidKaspaAmountForWithdrawalError extends Error {
    constructor(
        public readonly requiredAmount: bigint,
        public readonly totalBalance: bigint
    ) {
      super(`Invalid Kaspa Amount for withdrawal. Total balance is ${totalBalance}, required balance is ${requiredAmount}.`);
      this.name = 'InvalidKaspaAmountForWithdrawalError';
    }
  }
  