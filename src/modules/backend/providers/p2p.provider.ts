import { Injectable } from '@nestjs/common';
import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';

@Injectable()
export class P2pProvider {
  constructor(
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
  ) {}

  public async createSellOrder(dto: SellRequestDto) {
    const sellOrderDm =
      P2pOrderBookTransformer.transformSellRequestDtoToOrderDm(dto);
    await this.p2pOrderBookService.createSell(sellOrderDm);
    // todo create wallet
  }

  async buy(buyRequestDto: BuyRequestDto) {
    return Promise.resolve(undefined);
  }

  async getCurrentFeeRate() {
    return await this.kaspaNetworkActionsService.getCurrentFeeRate();
  }
}
