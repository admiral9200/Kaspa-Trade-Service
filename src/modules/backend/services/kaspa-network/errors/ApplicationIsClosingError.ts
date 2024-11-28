export class ApplicationIsClosingError extends Error {
  constructor() {
    super('Application is closing');
    this.name = this.constructor.name;
  }
}
