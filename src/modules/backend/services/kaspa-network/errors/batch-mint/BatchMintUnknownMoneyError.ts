import { BatchMintEntity } from 'src/modules/backend/model/schemas/batch-mint.schema';

export class BatchMintUnknownMoneyError extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly batchMint: BatchMintEntity,
  ) {
    super(`Unknown money for order ${batchMint._id}. Wallet amount is ${walletAmount}.`);
    this.name = 'BatchMintUnknownMoneyError';
  }
}
