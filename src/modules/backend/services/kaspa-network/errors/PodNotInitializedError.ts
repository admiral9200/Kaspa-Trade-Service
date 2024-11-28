export class PodNotInitializedError extends Error {
  constructor(
    public readonly error: any,
    public readonly entity: any,
  ) {
    super(`PodNotInitializedError for ${entity.constructor.name} ${entity._id}. Error: ${error?.message || error}.`);
    this.name = 'PodNotInitializedError';
  }
}
