export class LunchpadNotEnoughUserAvailableQtyError extends Error {
  constructor(
    public lunchpadId: string,
    public walletAddress: string,
  ) {
    super(`Wallet ${walletAddress} does not have enough available qty on Lunchpad ${lunchpadId}.`);
    this.name = this.constructor.name;
  }
}
