import { BatchMintEntity } from 'src/modules/backend/model/schemas/batch-mint.schema';

export class IncorrectUtxoAmountForBatchMint extends Error {
  constructor(
    public readonly walletAmount: number,
    public readonly expectedAmount: number,
    public readonly batchMintEntity: BatchMintEntity,
  ) {
    super(
      `Incorrect Utxo amount for batch mint. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount} or higher. Batch mint ${batchMintEntity._id}.`,
    );
    this.name = 'IncorrectUtxoAmountForBatchMint';
  }
}
