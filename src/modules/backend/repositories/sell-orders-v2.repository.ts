import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model } from 'mongoose';
import { P2pOrderV2Entity } from '../model/schemas/p2p-order-v2.schema';
import { SellOrderStatusV2 } from '../model/enums/sell-order-status-v2.enum';

@Injectable()
export class SellOrdersV2Repository extends BaseRepository<P2pOrderV2Entity> {
  constructor(
    @InjectModel(P2pOrderV2Entity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrderV2Model: Model<P2pOrderV2Entity>,
  ) {
    super(sellOrderV2Model);
  }

  async updateBuyerAndStatus(sellOrderId: string, buyerWalletAddress: string, transactionId: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.LISTED_FOR_SALE },
      { $set: { buyerWalletAddress, status: SellOrderStatusV2.VERIFYING, buyerTransactionId: transactionId } },
      { new: true },
    );
  }

  async reopenSellOrder(sellOrderId: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.VERIFYING },
      { $set: { status: SellOrderStatusV2.LISTED_FOR_SALE } },
      { new: true },
    );
  }

  async setOrderToCompleted(sellOrderId: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.VERIFYING },
      { $set: { status: SellOrderStatusV2.COMPLETED } },
      { new: true },
    );
  }

  async cancelSellOrder(sellOrderId: string, ownerWallet: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.LISTED_FOR_SALE, sellerWalletAddress: ownerWallet },
      { $set: { status: SellOrderStatusV2.CANCELED } },
      { new: true },
    );
  }
}
