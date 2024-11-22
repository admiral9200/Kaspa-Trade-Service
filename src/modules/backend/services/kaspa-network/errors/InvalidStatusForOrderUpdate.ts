export class InvalidStatusForOrderUpdateError extends Error {
  constructor(public readonly orderId?: string) {
    super(`Invalid status for order update. Order ID: ${orderId || '--'}`);
    this.name = 'InvalidStatusForOrderUpdateError';
  }
}
