import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pProvider } from '../providers/p2p.provider';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';

@Injectable()
export class P2pOrdersExpirationCronJob {
  static isRunning = false;

  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly logger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    if (P2pOrdersExpirationCronJob.isRunning) {
      this.logger.error('CRON JOB ALREADY RUNNING, PLEASE CHECK WHY IT IS TAKING TOO LONG');
      return;
    }

    P2pOrdersExpirationCronJob.isRunning = true;

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

    P2pOrdersExpirationCronJob.isRunning = false;
  }
}
