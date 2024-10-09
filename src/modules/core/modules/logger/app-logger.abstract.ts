import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';

@Injectable()
export abstract class AppLogger {
  protected context: string;

  constructor(@Inject('LOGGER') protected readonly logger: Logger) {
    this.context = 'Default';
  }

  setContext(context: string) {
    this.context = context;
  }

  protected abstract getMetadata(): any;

  private getMessageWithContext(message: string): string {
    return `[${this.context}] ${message}`;
  }

  error(message: string, trace?: string, meta?: object) {
    this.logger.error(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
      trace,
    });
  }

  warn(message: string, meta?: object) {
    this.logger.warn(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
    });
  }

  info(message: string, meta?: object) {
    this.logger.info(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
    });
  }

  http(message: string, meta?: object) {
    this.logger.http(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
    });
  }

  verbose(message: string, meta?: object) {
    this.logger.verbose(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
    });
  }

  debug(message: string, meta?: object) {
    this.logger.debug(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
    });
  }

  silly(message: string, meta?: object) {
    this.logger.silly(this.getMessageWithContext(message), {
      ...this.getMetadata(),
      ...meta,
    });
  }
}
