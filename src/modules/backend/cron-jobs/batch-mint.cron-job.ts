import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { BaseCronJob } from './base-cron-job';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BatchMintProvider } from '../providers/batch-mint.provider';

@Injectable()
export class BatchMintCronJob extends BaseCronJob {
  constructor(
    logger: AppLogger,
    telegramBotService: TelegramBotService,
    private readonly batchMintProvider: BatchMintProvider,
  ) {
    super(logger, telegramBotService);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.runOnce(async () => {
      try {
        await this.batchMintProvider.handleWaitingKasMints();
      } catch (error) {
        this.logger.error('error in handleWaitingKasMints');
        this.logger.error(error, error?.stack, error?.meta);
      }
    }, 'handleWaitingKasMints');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleNotifyStuckJobsCron() {
    await this.runOnce(async () => {
      try {
        await this.batchMintProvider.notifyStuckOnWaitingForJobMints();
      } catch (error) {
        this.logger.error('error in notifyStuckOnWaitingForJobMints');
        this.logger.error(error, error?.stack, error?.meta);
      }
    }, 'notifyStuckJobsCron');
  }
}
