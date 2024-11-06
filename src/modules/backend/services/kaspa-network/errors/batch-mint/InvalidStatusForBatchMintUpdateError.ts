import { BatchMintEntity } from 'src/modules/backend/model/schemas/batch-mint.schema';

export class InvalidStatusForBatchMintUpdateError extends Error {
  constructor(
    public readonly batchMintEntityId: string,
    private readonly batchMintEntity?: BatchMintEntity,
  ) {
    super(
      `Invalid status for batch mint update. Batch mint id: ${batchMintEntityId}${batchMintEntity ? `, Current status: ${batchMintEntity.status}` : ''}`,
    );
    this.name = 'InvalidStatusForBatchMintUpdateError';
  }
}
