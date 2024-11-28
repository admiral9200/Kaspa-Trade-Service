import { BatchMintEntity } from 'src/modules/backend/model/schemas/batch-mint.schema';

export class IncorrectKaspaAmountForBatchMint extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly expectedAmount: bigint,
    public readonly batchMint: BatchMintEntity,
  ) {
    super(
      `Incorrect kaspa amount for batch mint. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount} or higher. Batch mint ${batchMint._id}.`,
    );
    this.name = 'IncorrectKaspaAmountForBatchMint';
  }
}
