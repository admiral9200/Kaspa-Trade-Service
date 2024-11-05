export class StuckOnWaitingForJobBatchMints extends Error {
  constructor(public readonly ids: string[]) {
    super(`There are ${ids.length} stuck in waiting for job.`);
    this.name = 'StuckOnWaitingForJobBatchMints';
  }
}
