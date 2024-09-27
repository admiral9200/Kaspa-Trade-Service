import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { P2pProvider } from '../providers/p2p.provider';

@Injectable()
export class P2pOrdersExpirationCronJob {
  constructor(private readonly p2pProvider: P2pProvider) {}
  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    await this.p2pProvider.handleExpiredOrders();
  }
}
