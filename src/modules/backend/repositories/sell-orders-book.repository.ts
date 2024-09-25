import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { P2pOrder } from '../model/schemas/p2p-order.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model, SortOrder } from 'mongoose';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { SortDirection } from '../model/enums/sort-direction.enum';

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

  async getListedSellOrders(
    ticker: string,
    walletAddress?: string,
    sort?: SortDto,
    pagination?: PaginationDto,
  ): Promise<P2pOrder[]> {
    try {
      const baseQuery = { status: SellOrderStatus.LISTED_FOR_SALE, ticker };

      if (walletAddress) {
        Object.assign(baseQuery, { sellerWalletAddress: walletAddress });
      }

      let query = this.sellOrdersModel.find(baseQuery);

      if (sort?.direction) {
        const sortField = sort.field || '_id'; // Default to '_id' if no field is specified
        const sortOrder: SortOrder = sort.direction === SortDirection.ASC ? 1 : -1;
        query = query.sort({ [sortField]: sortOrder } as { [key: string]: SortOrder });
      }

      if (pagination) {
        if (typeof pagination.offset === 'number') {
          query = query.skip(pagination.offset);
        }
        if (typeof pagination.limit === 'number') {
          query = query.limit(pagination.limit);
        }
      }

      return await query.exec();
    } catch (error) {
      console.error('Error getting sell orders', error);
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
