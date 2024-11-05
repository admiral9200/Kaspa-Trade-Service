import { BatchMintEntity } from 'src/modules/backend/model/schemas/batch-mint.schema';

export class BatchMintUnknownMoneyError extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly expectedAmount: bigint,
    public readonly batchMint: BatchMintEntity,
  ) {
    super(
      `Unknown money for batch mint ${batchMint._id}. Wallet amount is ${walletAmount}, expected amount is ${expectedAmount}.`,
    );
    this.name = 'BatchMintUnknownMoneyError';
  }
}
