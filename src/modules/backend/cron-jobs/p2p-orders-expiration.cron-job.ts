import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pProvider } from '../providers/p2p.provider';

@Injectable()
export class P2pOrdersExpirationCronJob {
  constructor(private readonly p2pProvider: P2pProvider) {}
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    try {
      await this.p2pProvider.handleWatingForFeeOrders();
    } catch (error) {
      console.error('error handaling waiting for fee orders');
    }
    try {
      await this.p2pProvider.handleExpiredOrders();
    } catch (error) {
      console.error('error handaling expired orders');
    }
  }
}
