import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { P2pOrdersService } from '../services/p2p-orders.service';

@Injectable()
export class P2pOrdersExpirationCronJob {
  constructor(private readonly p2pOrderBookService: P2pOrdersService) {}
  @Cron(CronExpression.EVERY_MINUTE)
  handleCron() {
    this.p2pOrderBookService.cancelExpiredOrders();
  }
}
