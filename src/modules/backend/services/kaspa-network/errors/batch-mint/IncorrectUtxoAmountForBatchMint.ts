export class IncorrectUtxoAmountForBatchMint extends Error {
  constructor(
    public readonly walletAmount: number,
    public readonly expectedAmount: number,
  ) {
    super(
      `Incorrect Utxo amount for batch mint. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount} or higher.`,
    );
    this.name = 'IncorrectUtxoAmountForBatchMint';
  }
}
