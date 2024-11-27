import { Injectable } from '@nestjs/common';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { ImportantPromisesManager } from '../important-promises-manager/important-promises-manager';

@Injectable()
export class BaseCronJob {
  private isRunning = {};

  constructor(
    protected readonly logger: AppLogger,
    protected readonly telegramBotService: TelegramBotService,
  ) {}

  protected async runOnce(func: () => Promise<void>, jobName: string = 'base') {
    if (this.isRunning[jobName]) {
      const errorStr = `cron job ${jobName} in ${this.constructor.name} is already running, please check why it is taking too long`;
      this.logger.error(errorStr);
      this.telegramBotService.sendErrorToErrorsChannel(new Error(errorStr), true);
      return;
    }

    if (ImportantPromisesManager.isApplicationClosing()) {
      return;
    }

    this.isRunning[jobName] = true;

    try {
      await func();
    } catch (error) {
      this.logger.error(error, error?.stack, error?.meta);
    } finally {
      delete this.isRunning[jobName];
    }
  }
}
