export class ImportantPromisesManager {
  private static promises: Promise<any>[] = [];

  public static addPromise(promise: Promise<any>) {
    ImportantPromisesManager.promises.push(promise);
    promise.finally(() => {
      const index = ImportantPromisesManager.promises.indexOf(promise);
      if (index > -1) {
        ImportantPromisesManager.promises.splice(index, 1);
      }
    });
  }

  public static async waitForAllPromisesToResolve() {
    await Promise.all(ImportantPromisesManager.promises);
  }

  public static async waitForAllPromisesToResolveIfAny() {
    while (ImportantPromisesManager.promises.length > 0) {
      await Promise.all(ImportantPromisesManager.promises);
    }
  }
}
