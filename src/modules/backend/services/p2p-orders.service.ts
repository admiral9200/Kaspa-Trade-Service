import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../core/modules/logger/app-logger.service';
import { AppConfigService } from '../../core/modules/config/app-config.service';
import { HttpService } from '@nestjs/axios';
import { SellOrderDm } from '../model/dms/sell-order.dm';
import { SellOrdersBookRepository } from '../repositories/sell-orders-book.repository';

@Injectable()
export class P2pOrdersService {
  constructor(
    private readonly sellOrdersBookRepository: SellOrdersBookRepository,
  ) {}

  async createSell(order: SellOrderDm) {
    try {
      const sellOrder =
        await this.sellOrdersBookRepository.createSellOrder(order);
    } catch (err) {
      throw new HttpException(
        'Failed to create a new sell order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
