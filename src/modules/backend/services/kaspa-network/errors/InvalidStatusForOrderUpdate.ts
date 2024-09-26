export class InvalidStatusForOrderUpdateError extends Error {
  constructor() {
    super(`Invalid status for order update.`);
    this.name = 'InvalidStatusForOrderUpdateError';
  }
}
