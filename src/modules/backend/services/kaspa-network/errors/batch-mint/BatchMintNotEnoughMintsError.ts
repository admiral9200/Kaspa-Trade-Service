export class BatchMintNotEnoughMintsError extends Error {
  constructor(
    public readonly mintsLeft: number,
    public readonly batchMintId: string,
  ) {
    super(`Batch mint ${batchMintId} has not enough mints. Only ${mintsLeft} mints left.`);
    this.name = 'BatchMintNotEnoughMintsError';
  }
}
