import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { P2pOrder } from '../model/schemas/p2p-order.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model } from 'mongoose';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';

@Injectable()
export class SellOrdersBookRepository extends BaseRepository<P2pOrder> {
  constructor(
    @InjectModel(P2pOrder.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrdersModel: Model<P2pOrder>,
  ) {
    super(sellOrdersModel);
  }

  async setWaitingForKasStatus(orderId: string, expiresAt: Date): Promise<P2pOrder> {
    try {
      return await super.updateByOne(
        '_id',
        orderId,
        { status: SellOrderStatus.WAITING_FOR_KAS, expiresAt: expiresAt },
        { status: SellOrderStatus.LISTED_FOR_SALE },
      );
    } catch (error) {
      console.error(`Error updating to WAITING_FOR_KAS for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setCheckoutStatus(orderId: string): Promise<P2pOrder> {
    try {
      return await super.updateByOne(
        '_id',
        orderId,
        { status: SellOrderStatus.CHECKOUT },
        { status: SellOrderStatus.WAITING_FOR_KAS },
      );
    } catch (error) {
      console.error(`Error updating to CHECKOUT status for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async transitionOrderStatus(orderId: string, newStatus: SellOrderStatus, requiredStatus: SellOrderStatus): Promise<P2pOrder> {
    try {
      return await super.updateByOne('_id', orderId, { status: newStatus }, { status: requiredStatus });
    } catch (error) {
      console.error(`Error transitioning to ${newStatus} status for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setStatus(orderId: string, status: SellOrderStatus): Promise<P2pOrder> {
    try {
      return await super.updateByOne('_id', orderId, { status });
    } catch (error) {
      console.error(`Error updating sell order status by ID(${orderId}):`, error);

      throw error;
    }
  }

  async setBuyerWalletAddress(orderId: string, buyerWalletAddress: string): Promise<boolean> {
    try {
      const res = await super.updateByOne('_id', orderId, { buyerWalletAddress });
      return res !== null;
    } catch (error) {
      console.error(`Error updating buyer wallet address for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async getById(id: string): Promise<P2pOrder> {
    try {
      return await super.findOneBy('_id', id);
    } catch (error) {
      console.error('Error getting sell order by ID:', error);
      throw error;
    }
  }

  async createSellOrder(sellOrder: P2pOrder): Promise<P2pOrder> {
    try {
      return await super.create(sellOrder);
    } catch (error) {
      console.error('Error creating sell order:', error);
      throw error;
    }
  }

  async getListedSellOrders(): Promise<P2pOrder[]> {
    try {
      return await this.sellOrdersModel.find({ status: SellOrderStatus.LISTED_FOR_SALE }).exec();
    } catch (error) {
      console.log('Error getting sell orders', error);
      throw error;
    }
  }

  async updateAndGetExpiredOrders(): Promise<P2pOrder[]> {
    try {
      const currentDate = new Date();
      const updatedOrders = await this.sellOrdersModel
        .find({
          status: {
            $in: [SellOrderStatus.WAITING_FOR_KAS],
          },
          expiresAt: { $lt: currentDate },
        })
        .exec();

      const updatedOrderIds = updatedOrders.map((order) => order._id);

      await this.sellOrdersModel.updateMany(
        { _id: { $in: updatedOrderIds } },
        { $set: { status: SellOrderStatus.LISTED_FOR_SALE, buyerWalletAddress: undefined } },
      );

      return updatedOrders;
    } catch (error) {
      console.error('Error updating and getting expired orders:', error);
      throw error;
    }
  }
}
