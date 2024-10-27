export class IncorrectKaspaAmountForBatchMint extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly expectedAmount: bigint,
  ) {
    super(
      `Incorrect kaspa amount for batch mint. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount} or higher.`,
    );
    this.name = 'IncorrectKaspaAmountForBatchMint';
  }
}
