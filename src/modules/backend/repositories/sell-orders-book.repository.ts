import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model, SortOrder, ClientSession } from 'mongoose';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { SortDirection } from '../model/enums/sort-direction.enum';
import { InvalidStatusForOrderUpdateError } from '../services/kaspa-network/errors/InvalidStatusForOrderUpdate';

@Injectable()
export class SellOrdersBookRepository extends BaseRepository<P2pOrderEntity> {
  constructor(
    @InjectModel(P2pOrderEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrdersModel: Model<P2pOrderEntity>,
  ) {
    super(sellOrdersModel);
  }

  async setWaitingForKasStatus(orderId: string, expiresAt: Date, session?: ClientSession): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.WAITING_FOR_KAS,
      SellOrderStatus.LISTED_FOR_SALE,
      { expiresAt: expiresAt },
      session,
    );
  }

  async setDelistWaitingForKasStatus(orderId: string, session?: ClientSession): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.OFF_MARKETPLACE,
      SellOrderStatus.LISTED_FOR_SALE,
      {},
      session,
    );
  }

  async setSwapError(orderId: string, errorMessage: string): Promise<P2pOrderEntity> {
    try {
      return await super.updateByOne('_id', orderId, { status: SellOrderStatus.SWAP_ERROR, error: errorMessage });
    } catch (error) {
      console.error(`Error updating to SWAP_ERROR for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setDelistError(orderId: string, errorMessage: string): Promise<P2pOrderEntity> {
    try {
      return await super.updateByOne('_id', orderId, { status: SellOrderStatus.DELIST_ERROR, error: errorMessage });
    } catch (error) {
      console.error(`Error updating to DELIST_ERROR for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setOrderCompleted(orderId: string, isDelisting: boolean = false): Promise<P2pOrderEntity> {
    try {
      return await super.updateByOne('_id', orderId, {
        status: isDelisting ? SellOrderStatus.COMPLETED_DELISTING : SellOrderStatus.COMPLETED,
        fulfillmentTimestamp: Date.now(),
      });
    } catch (error) {
      console.error(`Error updating to SWAP_ERROR for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setCheckoutStatus(orderId: string, fromLowFee: boolean = false, session?: ClientSession): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.CHECKOUT,
      fromLowFee ? SellOrderStatus.WAITING_FOR_LOW_FEE : SellOrderStatus.WAITING_FOR_KAS,
      {},
      session,
    );
  }

  async setLowFeeStatus(orderId: string): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(orderId, SellOrderStatus.WAITING_FOR_LOW_FEE, SellOrderStatus.CHECKOUT);
  }

  async setDelistStatus(orderId: string): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(orderId, SellOrderStatus.DELISTING, SellOrderStatus.OFF_MARKETPLACE);
  }

  async transitionOrderStatus(
    orderId: string,
    newStatus: SellOrderStatus,
    requiredStatus: SellOrderStatus,
    additionalData: Partial<P2pOrderEntity> = {},
    session?: ClientSession,
  ): Promise<P2pOrderEntity> {
    try {
      const order = await super.updateByOne(
        '_id',
        orderId,
        { status: newStatus, ...additionalData },
        { status: requiredStatus },
        session,
      );

      if (!order) {
        console.log('Failed assigning buyer, already in progress');
        throw new InvalidStatusForOrderUpdateError();
      }

      return order;
    } catch (error) {
      if (!this.isOrderInvalidStatusUpdateError(error)) {
        console.error(`Error updating to WAITING_FOR_KAS for order by ID(${orderId}):`, error);
      }

      throw error;
    }
  }

  async setStatus(orderId: string, status: SellOrderStatus, session?: ClientSession): Promise<P2pOrderEntity> {
    try {
      return await super.updateByOne('_id', orderId, { status }, {}, session);
    } catch (error) {
      console.error(`Error updating sell order status by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setBuyerWalletAddress(orderId: string, buyerWalletAddress: string, session?: ClientSession): Promise<boolean> {
    try {
      const res = await super.updateByOne('_id', orderId, { buyerWalletAddress }, {}, session);
      return res !== null;
    } catch (error) {
      console.error(`Error updating buyer wallet address for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async getById(id: string, session?: ClientSession): Promise<P2pOrderEntity> {
    try {
      return await super.findOneBy('_id', id, session);
    } catch (error) {
      console.error('Error getting sell order by ID:', error);
      throw error;
    }
  }

  async createSellOrder(sellOrder: P2pOrderEntity, session?: ClientSession): Promise<P2pOrderEntity> {
    try {
      return await super.create(sellOrder, session);
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
  ): Promise<{ orders: P2pOrderEntity[]; totalCount: number }> {
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
      const totalCount = await this.sellOrdersModel.countDocuments(baseQuery);
      const orders: P2pOrderEntity[] = await query.exec();

      return { orders, totalCount };
    } catch (error) {
      console.error('Error getting sell orders', error);
      throw error;
    }
  }

  async getUserListedSellOrders(
    walletAddress: string,
    statuses: SellOrderStatus[],
    sort?: SortDto,
    pagination?: PaginationDto,
    session?: ClientSession,
  ): Promise<P2pOrderEntity[]> {
    try {
      const baseQuery = { status: { $in: statuses } };

      if (walletAddress) {
        Object.assign(baseQuery, { sellerWalletAddress: walletAddress });
      }

      let query = this.sellOrdersModel.find(baseQuery).session(session);

      if (sort?.direction) {
        const sortField = sort.field || '_id';
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

  async getExpiredOrders(): Promise<P2pOrderEntity[]> {
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

      return updatedOrders;
    } catch (error) {
      console.error('Error getting expired orders', error);
      return [];
    }
  }

  public isOrderInvalidStatusUpdateError(error) {
    return error instanceof InvalidStatusForOrderUpdateError || this.isDocumentTransactionLockedError(error);
  }
}
