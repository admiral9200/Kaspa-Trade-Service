export class InvalidKaspaAmountForWithdrawalError extends Error {
    constructor(
        public readonly requiredAmount: bigint,
        public readonly availableBalance: bigint
    ) {
      super(`Invalid Kaspa Amount for withdrawal. Available balance is ${availableBalance}, required balance is ${requiredAmount}.`);
      this.name = 'InvalidKaspaAmountForWithdrawalError';
    }
  }
  