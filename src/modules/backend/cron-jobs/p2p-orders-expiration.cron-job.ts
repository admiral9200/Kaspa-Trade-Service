import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pProvider } from '../providers/p2p.provider';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { BaseCronJob } from './base-cron-job';

@Injectable()
export class P2pOrdersExpirationCronJob extends BaseCronJob {
  constructor(
    logger: AppLogger,
    telegramBotService: TelegramBotService,
    private readonly p2pProvider: P2pProvider,
  ) {
    super(logger, telegramBotService);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.runOnce(async () => {
      try {
        await this.p2pProvider.handleWatingForFeeOrders();
      } catch (error) {
        this.logger.error('error handaling waiting for fee orders');
        this.logger.error(error, error?.stack, error?.meta);
      }
      try {
        await this.p2pProvider.handleExpiredOrders();
      } catch (error) {
        this.logger.error('error handaling expired orders');
        this.logger.error(error, error?.stack, error?.meta);
      }

      try {
        await this.p2pProvider.notifyStuckOrders();
      } catch (error) {
        this.logger.error('error notifiing stuck orders');
        this.logger.error(error, error?.stack, error?.meta);
      }

      try {
        await this.p2pProvider.handleWaitingTokensOrders();
      } catch (error) {
        this.logger.error('error handaling waiting tokens orders');
        this.logger.error(error, error?.stack, error?.meta);
      }
    });
  }
}
