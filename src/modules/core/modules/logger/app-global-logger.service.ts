import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { AppLogger } from './app-logger.abstract';

@Injectable()
export class AppGlobalLoggerService extends AppLogger {
  constructor(@Inject('LOGGER') readonly logger: Logger) {
    super(logger);
  }

  protected getMetadata() {
    return {
      global: true,
    };
  }
}
