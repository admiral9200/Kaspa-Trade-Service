export class IncorrectKaspaAmountForKrc20Action extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly expectedAmount: bigint,
  ) {
    super(`Incorrect kaspa amount for krc20 action. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount}.`);
    this.name = 'IncorrectKaspaAmountForSwap';
  }
}
