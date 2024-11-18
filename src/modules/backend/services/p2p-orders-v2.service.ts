import { Injectable } from '@nestjs/common';
import { SellOrdersV2Repository } from '../repositories/sell-orders-v2.repository';
import { SellOrderV2Dto } from '../model/dtos/p2p-orders/sell-order-v2.dto';
import { SellOrderStatusV2 } from '../model/enums/sell-order-status-v2.enum';

@Injectable()
export class P2pOrdersV2Service {
  constructor(private readonly sellOrdersV2Repository: SellOrdersV2Repository) {}

  async create(sellOrderDto: SellOrderV2Dto, walletAddress: string) {
    return await this.sellOrdersV2Repository.create({
      pricePerToken: sellOrderDto.pricePerToken,
      psktSeller: sellOrderDto.psktSeller,
      quantity: sellOrderDto.quantity,
      sellerWalletAddress: walletAddress,
      ticker: sellOrderDto.ticker,
      totalPrice: sellOrderDto.totalPrice,
      status: SellOrderStatusV2.LISTED_FOR_SALE,
      psktTransactionId: sellOrderDto.psktTransactionId,
    });
  }

  async getById(id: string) {
    return await this.sellOrdersV2Repository.getById(id);
  }

  async updateBuyerAndCloseSell(orderId: string, buyerWalletAddress: string) {
    const result = await this.sellOrdersV2Repository.updateBuyerAndCloseSell(orderId, buyerWalletAddress);

    if (!result) {
      throw new Error('Incorrect status for buying an order');
    }

    return result;
  }

  async cancelSellOrder(orderId: string, ownerWallet: string) {
    const result = await this.sellOrdersV2Repository.cancelSellOrder(orderId, ownerWallet);

    if (!result) {
      throw new Error('Incorrect status for canceling an order');
    }

    return result;
  }
}
