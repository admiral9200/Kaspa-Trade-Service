import { Injectable, Inject, Scope } from '@nestjs/common';
import { Logger } from 'winston';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AppLogger } from './app-logger.abstract';

@Injectable({ scope: Scope.REQUEST })
export class AppRequestLoggerService extends AppLogger {
  constructor(
    @Inject('LOGGER') readonly logger: Logger,
    @Inject(REQUEST) private readonly request: Request,
  ) {
    super(logger);
  }

  protected getMetadata() {
    return {
      requestId: this.request.headers['x-request-id'] || 'N/A',
      userId: (this.request as any).user?.id || 'N/A',
      path: this.request.path,
      method: this.request.method,
    };
  }
}
