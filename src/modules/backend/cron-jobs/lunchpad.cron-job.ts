import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { BaseCronJob } from './base-cron-job';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LunchpadProvider } from '../providers/lunchpad.provider';

@Injectable()
export class LunchpadCronJob extends BaseCronJob {
  constructor(
    logger: AppLogger,
    telegramBotService: TelegramBotService,
    private readonly lunchpadProvider: LunchpadProvider,
  ) {
    super(logger, telegramBotService);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.runOnce(async () => {
      try {
        await this.lunchpadProvider.handleWaitingKasLunchpadOrders();
      } catch (error) {
        this.logger.error('error in handleWaitingKasLunchpadOrders');
        this.logger.error(error, error?.stack, error?.meta);
      }
    }, 'handleWaitingKasLunchpadOrders');
  }
}
