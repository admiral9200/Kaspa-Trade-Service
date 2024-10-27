export class InvalidStatusForBatchMintUpdateError extends Error {
  constructor() {
    super(`Invalid status for batch mint update.`);
    this.name = 'InvalidStatusForBatchMintUpdateError';
  }
}
