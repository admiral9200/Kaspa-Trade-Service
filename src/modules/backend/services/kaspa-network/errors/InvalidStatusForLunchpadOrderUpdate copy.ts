export class InvalidStatusForLunchpadOrderUpdateError extends Error {
  constructor() {
    super(`Invalid status for lunchpad order update.`);
    this.name = 'InvalidStatusForLunchpadOrderUpdateError';
  }
}
