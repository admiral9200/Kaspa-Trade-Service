import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pProvider } from '../providers/p2p.provider';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';

@Injectable()
export class P2pOrdersExpirationCronJob {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly logger: AppLogger,
  ) {}
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
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
  }
}
