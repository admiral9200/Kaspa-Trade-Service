export class IncorrectKaspaAmountForSwap extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly expectedAmount: bigint,
  ) {
    super(`Incorrect kaspa amount for swap. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount}.`);
    this.name = 'IncorrectKaspaAmountForSwap';
  }
}
