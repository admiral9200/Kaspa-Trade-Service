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
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';
import { GetOrdersHistoryFiltersDto } from '../model/dtos/p2p-orders/get-orders-history-filters.dto';
import { OrdersManagementUpdateSellOrderDto } from '../model/dtos/p2p-orders/orders-management-update-sell-order.dto';

const STUCK_SWAPS_TIME_TO_CHECK = 60 * 60 * 1000;
const WAITING_FOR_TOKENS_TIME_TO_CHECK = 5 * 60 * 1000;

@Injectable()
export class SellOrdersBookRepository extends BaseRepository<P2pOrderEntity> {
  constructor(
    @InjectModel(P2pOrderEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrdersModel: Model<P2pOrderEntity>,
  ) {
    super(sellOrdersModel);
  }

  async setWaitingForKasStatus(
    orderId: string,
    expiresAt: Date,
    session?: ClientSession,
    fromExpired: boolean = false,
  ): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.WAITING_FOR_KAS,
      fromExpired ? SellOrderStatus.CHECKING_EXPIRED : SellOrderStatus.LISTED_FOR_SALE,
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

  async setUnknownMoneyErrorStatus(orderId: string): Promise<P2pOrderEntity> {
    try {
      return await super.updateByOne('_id', orderId, {
        status: SellOrderStatus.UNKNOWN_MONEY_ERROR,
      });
    } catch (error) {
      console.error(`Error updating to UNKNOWN_MONEY_ERROR for order by ID(${orderId}):`, error);
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
      console.error(`Error updating to COMPLETED for order by ID(${orderId}):`, error);
      throw error;
    }
  }

  async setCheckoutStatus(orderId: string, fromLowFee: boolean = false): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.CHECKOUT,
      fromLowFee ? SellOrderStatus.WAITING_FOR_LOW_FEE : SellOrderStatus.WAITING_FOR_KAS,
      {},
    );
  }

  async setLowFeeStatus(orderId: string, fromDelist: boolean = false): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.WAITING_FOR_LOW_FEE,
      fromDelist ? SellOrderStatus.DELISTING : SellOrderStatus.CHECKOUT,
    );
  }

  async setDelistStatus(orderId: string, fromLowFee: boolean = false): Promise<P2pOrderEntity> {
    return await this.transitionOrderStatus(
      orderId,
      SellOrderStatus.DELISTING,
      fromLowFee ? SellOrderStatus.WAITING_FOR_LOW_FEE : SellOrderStatus.OFF_MARKETPLACE,
      {
        isDelist: true,
      },
    );
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
        console.log('Failed assigning status, already in progress');
        throw new InvalidStatusForOrderUpdateError();
      }

      return order;
    } catch (error) {
      if (!this.isOrderInvalidStatusUpdateError(error)) {
        console.error(`Error updating to ${newStatus} for order by ID(${orderId}):`, error);
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
    sort?: SortDto,
    pagination?: PaginationDto,
  ): Promise<{ orders: P2pOrderEntity[]; totalCount: number }> {
    try {
      const baseQuery = { status: SellOrderStatus.LISTED_FOR_SALE, ticker };

      let query: any = this.sellOrdersModel.find(baseQuery);

      if (sort) {
        query = this.applySort(query, sort);
      }

      if (pagination) {
        query = this.applyPagination(query, pagination);
      }

      const totalCount = await this.sellOrdersModel.countDocuments(baseQuery);
      const orders: P2pOrderEntity[] = await query.exec();

      return { orders, totalCount } as any;
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
  ): Promise<{ orders: P2pOrderEntity[]; totalCount: number }> {
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
      const totalCount = await this.sellOrdersModel.countDocuments(baseQuery);
      const orders: P2pOrderEntity[] = await query.exec();

      return { orders, totalCount } as any;
    } catch (error) {
      console.error('Error getting sell orders', error);
      throw error;
    }
  }

  async getExpiredOrders(): Promise<P2pOrderEntity[]> {
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
  }

  async getWaitingForTokensOrders(): Promise<P2pOrderEntity[]> {
    const dateToCheckBefore = new Date(Date.now() - WAITING_FOR_TOKENS_TIME_TO_CHECK);
    const updatedOrders = await this.sellOrdersModel
      .find({
        status: {
          $in: [SellOrderStatus.WAITING_FOR_TOKENS],
        },
        createdAt: { $lt: dateToCheckBefore },
      })
      .exec();

    return updatedOrders;
  }

  async getWaitingForFeesOrders(): Promise<P2pOrderEntity[]> {
    const orders = await this.sellOrdersModel
      .find({
        status: {
          $in: [SellOrderStatus.WAITING_FOR_LOW_FEE],
        },
      })
      .exec();

    return orders;
  }

  public isOrderInvalidStatusUpdateError(error) {
    return error instanceof InvalidStatusForOrderUpdateError || this.isDocumentTransactionLockedError(error);
  }

  async updateSellOrderPrices(sellOrderId: string, totalPrice: number, pricePerToken: number): Promise<void> {
    try {
      const updatedOrder = await this.sellOrdersModel
        .updateOne(
          { _id: sellOrderId, status: SellOrderStatus.OFF_MARKETPLACE },
          {
            totalPrice,
            pricePerToken,
          },
        )
        .exec();

      if (!updatedOrder) {
        throw new InvalidStatusForOrderUpdateError();
      }
    } catch (error) {
      if (!(error instanceof InvalidStatusForOrderUpdateError)) {
        console.log('Error updating sell order prices:', error);
      }
      throw error;
    }
  }

  async relistSellOrder(sellOrderId: string) {
    return await this.transitionOrderStatus(sellOrderId, SellOrderStatus.LISTED_FOR_SALE, SellOrderStatus.OFF_MARKETPLACE);
  }

  async updateSwapTransactionsResult(sellOrderId: string, transactionsResult: Partial<SwapTransactionsResult>): Promise<void> {
    try {
      await this.sellOrdersModel
        .updateOne(
          { _id: sellOrderId },
          {
            $set: {
              transactions: transactionsResult,
            },
          },
        )
        .exec();
    } catch (error) {
      console.log('Error updating sell order transactions result:', error);
      throw error;
    }
  }

  async getOrdersHistory(
    filters: GetOrdersHistoryFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
    walletAddress: string,
  ): Promise<{ orders: P2pOrderEntity[]; totalCount: number; allTickers: string[] }> {
    try {
      const filterQuery: any = {};
      const tickerQuery: any = {};
      filterQuery.$or = []; // Initialize the $or array
      tickerQuery.$or = [];
      // Filters
      if (filters) {
        if (filters.statuses && filters.statuses.length > 0) {
          filterQuery.status = { $in: filters.statuses };
        } else {
          filterQuery.status = { $nin: [SellOrderStatus.TOKENS_NOT_SENT] };
        }

        if (filters.tickers && filters.tickers.length > 0) {
          filterQuery.ticker = { $in: filters.tickers };
        }
        if (filters.isSeller) {
          filterQuery.$or.push({ sellerWalletAddress: walletAddress });
          tickerQuery.$or.push({ sellerWalletAddress: walletAddress });
        }
        if (filters.isBuyer) {
          filterQuery.$or.push({ buyerWalletAddress: walletAddress });
          tickerQuery.$or.push({ buyerWalletAddress: walletAddress });
        }
        if (filters.totalPrice) {
          const priceFilter: { $gte?: number; $lte?: number } = {};

          if (filters.totalPrice?.min) {
            priceFilter.$gte = filters.totalPrice.min;
          }

          if (filters.totalPrice?.max) {
            priceFilter.$lte = filters.totalPrice.max;
          }

          // Only add priceFilter if at least one of $gte or $lte is set
          if (Object.keys(priceFilter).length > 0) {
            filterQuery.totalPrice = priceFilter;
          }
        }
        if (filters.startDateTimestamp || filters.endDateTimestamp) {
          filterQuery.createdAt = {};
          if (filters.startDateTimestamp) {
            filterQuery.createdAt.$gte = new Date(filters.startDateTimestamp);
          }
          if (filters.endDateTimestamp) {
            filterQuery.createdAt.$lte = new Date(filters.endDateTimestamp);
          }
        }
      }

      // Create the base query
      let query: any = this.sellOrdersModel.find(filterQuery);

      // Apply sorting
      query = this.applySort(query, sort);

      // Get total count before pagination
      const totalCount = await this.sellOrdersModel.countDocuments(filterQuery);
      const allTickers = await this.sellOrdersModel.distinct('ticker', tickerQuery);
      // Apply pagination
      query = this.applyPagination(query, pagination);

      // Execute the query
      const orders = await query.exec();

      return { orders, totalCount, allTickers } as any;
    } catch (error) {
      console.error('Error getting orders history:', error);
      throw error;
    }
  }

  async updateOrderFromOrdersManagement(
    orderId: string,
    updateSellOrderDto: OrdersManagementUpdateSellOrderDto,
  ): Promise<P2pOrderEntity> {
    return await this.updateByOne('_id', orderId, updateSellOrderDto);
  }

  async setWalletKeyExposedBy(order: P2pOrderEntity, viewerWallet: string) {
    return await this.updateByOne('_id', order._id, {
      walletKeyExposedBy: (order.walletKeyExposedBy || []).concat([
        {
          wallet: viewerWallet,
          timestamp: Date.now(),
        },
      ]),
    });
  }

  async getStuckOrders(): Promise<P2pOrderEntity[]> {
    const lastHour = new Date(Date.now() - STUCK_SWAPS_TIME_TO_CHECK);
    const stuckOrders = await this.sellOrdersModel
      .find({
        status: {
          $in: [SellOrderStatus.CHECKOUT, SellOrderStatus.DELISTING],
        },
        updatedAt: { $lte: lastHour },
      })
      .exec();

    return stuckOrders;
  }
}
