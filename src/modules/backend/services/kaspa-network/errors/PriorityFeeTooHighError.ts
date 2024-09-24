export class PriorityFeeTooHighError extends Error {
  constructor() {
    super(`Priority fee is too high, please wait for market to cool down`);
    this.name = 'PriorityFeeTooHighError';
  }
}
