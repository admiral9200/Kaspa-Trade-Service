export class NotEnoughBalanceError extends Error {
  constructor() {
    super('Not enough balance to left in the wallet');
    this.name = 'NotEnoughBalanceError';
  }
}
