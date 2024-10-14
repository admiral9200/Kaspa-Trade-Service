export class InvalidStatusForLunchpadUpdateError extends Error {
  constructor() {
    super(`Invalid status for lunchpad update.`);
    this.name = 'InvalidStatusForLunchpadUpdateError';
  }
}
