import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilsHelper {
  async retryOnError<T>(
    fn: () => Promise<T>,
    times: number = 5,
    waitBeforeNextAttempt = 1000,
    skipLog: boolean = false,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < times) {
      try {
        return await fn();
      } catch (error) {
        attempt++;

        if (!skipLog) {
          console.log(`retryOnError: Error on attempt ${attempt} of ${times}`);
          console.log(error);
        }

        if (waitBeforeNextAttempt) {
          await new Promise((resolve) => setTimeout(resolve, waitBeforeNextAttempt));
        }

        if (attempt === times) {
          throw error;
        }
      }
    }
  }
}
