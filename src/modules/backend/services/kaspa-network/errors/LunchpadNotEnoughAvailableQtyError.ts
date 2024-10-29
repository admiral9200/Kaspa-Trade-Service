export class LunchpadNotEnoughAvailableQtyError extends Error {
  constructor(public lunchpadId: string) {
    super(`Lunchpad ${lunchpadId} does not have enough available qty.`);
    this.name = this.constructor.name;
  }
}
